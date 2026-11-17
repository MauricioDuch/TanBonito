import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { asyncHandler, requireAuth } from '../middleware/middleware.js';

interface Attempts { count: number; until?: number }

// Límite de intentos por IP y por usuario (mismo criterio que nabi-barber)
const attempts = new Map<string, Attempts>();
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 15 * 60 * 1000;

const isBlocked = (key: string) => {
  const a = attempts.get(key);
  if (!a?.until) return false;
  if (Date.now() > a.until) { attempts.delete(key); return false; }
  return true;
};

const fail = (key: string) => {
  const a = attempts.get(key) ?? { count: 0 };
  a.count++;
  if (a.count >= MAX_ATTEMPTS) a.until = Date.now() + BLOCK_TIME;
  attempts.set(key, a);
};

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  const keys = [`ip:${req.ip}`, `user:${username.trim().toLowerCase()}`];
  if (keys.some(isBlocked)) {
    return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' });
  }

  const [user] = await query<any[]>('SELECT * FROM users WHERE username = ?', [username.trim()]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    keys.forEach(fail);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  keys.forEach((k) => attempts.delete(k));
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo iniciar sesión' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.session.username });
});

// Crea el usuario inicial desde ADMIN_USER/ADMIN_PASSWORD si todavía no hay ninguno
export const ensureAdminUser = async () => {
  const [{ total }] = await query<any[]>('SELECT COUNT(*) AS total FROM users');
  if (total > 0) return;
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn('No hay usuarios: definí ADMIN_USER y ADMIN_PASSWORD para crear el primero.');
    return;
  }
  await query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, await bcrypt.hash(password, 10)]);
  console.log(`Usuario inicial "${username}" creado.`);
};

export default router;
