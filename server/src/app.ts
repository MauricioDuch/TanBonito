import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Fuera de Docker, toma las variables de server/.env si existe
try { process.loadEnvFile(); } catch { /* sin .env: se usan las variables del entorno */ }

const { waitForDb } = await import('./config/db.js');
const { runMigrations } = await import('./config/migrate.js');
const { requireAuth, errorHandler } = await import('./middleware/middleware.js');
const { crudRouter } = await import('./routes/crud.js');
const { default: authRoutes, ensureAdminUser } = await import('./routes/auth.js');
const { default: suppliesRoutes } = await import('./routes/supplies.js');
const { default: productsRoutes } = await import('./routes/products.js');
const { default: salesRoutes } = await import('./routes/sales.js');
const { default: purchasesRoutes } = await import('./routes/purchases.js');
const { default: statsRoutes } = await import('./routes/stats.js');
const { default: settingsRoutes } = await import('./routes/settings.js');
const { default: recipesRoutes } = await import('./routes/recipes.js');
const { default: stockRoutes } = await import('./routes/stock.js');
const { default: packagingRoutes } = await import('./routes/packaging.js');

const PORT = Number(process.env.PORT) || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En la imagen de producción el build de Vite se copia a ./public al lado de dist/
const STATIC_DIR = process.env.STATIC_DIR ?? path.join(__dirname, '../public');

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('Falta SESSION_SECRET');
}

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy ? (Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy)) : false);

app.use(session({
  name: 'tan-bonito',
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET || 'dev-secret',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12,
    secure: process.env.COOKIE_SECURE === 'true'
  }
}));

const api = express.Router();
api.get('/health', (req, res) => { res.json({ ok: true }); });
api.use('/auth', authRoutes);
api.use(requireAuth);
api.use('/suppliers', crudRouter({ table: 'suppliers', fields: ['name', 'contact', 'notes'], required: ['name'], orderBy: 'name' }));
api.use('/scents', crudRouter({ table: 'scents', fields: ['name', 'seasonal', 'active'], required: ['name'], orderBy: 'seasonal, name' }));
api.use('/fixed-expenses', crudRouter({ table: 'fixed_expenses', fields: ['name', 'monthly_amount'], required: ['name', 'monthly_amount'], orderBy: 'name' }));
api.use('/supplies', suppliesRoutes);
api.use('/products', productsRoutes);
api.use('/sales', salesRoutes);
api.use('/purchases', purchasesRoutes);
api.use('/stats', statsRoutes);
api.use('/settings', settingsRoutes);
api.use('/recipes', recipesRoutes);
api.use('/stock', stockRoutes);
api.use('/packaging', packagingRoutes);
api.use((req, res) => { res.status(404).json({ error: 'Ruta inexistente' }); });
app.use('/api', api);

// En producción el mismo server sirve el frontend (en desarrollo lo sirve Vite)
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));
}

app.use(errorHandler);

await waitForDb();
await runMigrations();
await ensureAdminUser();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Tan Bonito API escuchando en :${PORT}`);
});
