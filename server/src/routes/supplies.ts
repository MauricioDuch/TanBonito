import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler, missing } from '../middleware/middleware.js';

const router = Router();
const FIELDS = ['name', 'unit', 'package_qty', 'package_price', 'supplier_id', 'stock'];

// El precio unitario no se guarda: se calcula siempre a partir del envase
export const SUPPLY_SELECT = `
  SELECT s.*, ROUND(s.package_price / s.package_qty, 4) AS unit_price, p.name AS supplier_name
  FROM supplies s LEFT JOIN suppliers p ON p.id = s.supplier_id`;

router.get('/', asyncHandler(async (req, res) => {
  res.json(await query(`${SUPPLY_SELECT} ORDER BY s.name`));
}));

router.post('/', asyncHandler(async (req, res) => {
  const absent = missing(req.body, ['name', 'unit', 'package_qty', 'package_price']);
  if (absent) return res.status(400).json({ error: `Falta el campo ${absent}` });
  if (Number(req.body.package_qty) <= 0) return res.status(400).json({ error: 'La cantidad del envase debe ser mayor a 0' });
  if (Number(req.body.stock ?? 0) < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });
  const result: any = await query(
    `INSERT INTO supplies (${FIELDS.join(', ')}) VALUES (${FIELDS.map(() => '?').join(', ')})`,
    FIELDS.map((f) => req.body[f] ?? (f === 'stock' ? 0 : null))
  );
  const [row] = await query<any[]>(`${SUPPLY_SELECT} WHERE s.id = ?`, [result.insertId]);
  res.status(201).json(row);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (req.body.package_qty !== undefined && Number(req.body.package_qty) <= 0) {
    return res.status(400).json({ error: 'La cantidad del envase debe ser mayor a 0' });
  }
  if (Number(req.body.stock ?? 0) < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });
  const values = FIELDS.filter((f) => req.body[f] !== undefined);
  if (!values.length) return res.status(400).json({ error: 'Nada para actualizar' });
  await query(
    `UPDATE supplies SET ${values.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
    [...values.map((f) => req.body[f]), req.params.id]
  );
  const [row] = await query<any[]>(`${SUPPLY_SELECT} WHERE s.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  res.json(row);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await query('DELETE FROM supplies WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
