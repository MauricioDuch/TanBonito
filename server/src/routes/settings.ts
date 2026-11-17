import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../middleware/middleware.js';

export interface Settings { margin_percent: number; monthly_units: number }

const DEFAULTS: Settings = { margin_percent: 100, monthly_units: 200 };

export const getSettings = async (): Promise<Settings> => {
  const rows = await query<any[]>('SELECT name, value FROM settings');
  const settings = { ...DEFAULTS };
  rows.forEach((r) => {
    if (r.name in settings) settings[r.name as keyof Settings] = Number(r.value);
  });
  return settings;
};

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await getSettings());
}));

router.put('/', asyncHandler(async (req, res) => {
  for (const name of Object.keys(DEFAULTS)) {
    const value = Number(req.body?.[name]);
    if (req.body?.[name] === undefined) continue;
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: `Valor inválido para ${name}` });
    await query('INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [name, String(value)]);
  }
  res.json(await getSettings());
}));

export default router;
