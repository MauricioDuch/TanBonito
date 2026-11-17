import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler, missing } from '../middleware/middleware.js';

const router = Router();

// Costo por unidad = precio del pack / cantidad del pack (p. ej. 50 cajas a $25.000 = $500 c/u).
// used_in: qué productos lo llevan, para saber a quién afecta un cambio de precio.
const SELECT = `
  SELECT pk.*, ROUND(pk.package_price / pk.package_qty, 4) AS unit_price,
         (SELECT GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ')
          FROM product_packaging pp JOIN products p ON p.id = pp.product_id
          WHERE pp.packaging_id = pk.id) AS used_in
  FROM packaging pk`;

const validate = (b: any) => {
  const absent = missing(b, ['name', 'package_qty', 'package_price']);
  if (absent) return `Falta el campo ${absent}`;
  if (!(Number(b.package_qty) > 0)) return 'La cantidad del pack debe ser mayor a 0';
  if (!(Number(b.package_price) >= 0)) return 'El precio no puede ser negativo';
  return null;
};

router.get('/', asyncHandler(async (req, res) => {
  res.json(await query(`${SELECT} ORDER BY pk.name`));
}));

router.post('/', asyncHandler(async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });
  const { name, package_qty, package_price } = req.body;
  const result: any = await query(
    'INSERT INTO packaging (name, package_qty, package_price) VALUES (?, ?, ?)',
    [String(name).trim(), Number(package_qty), Number(package_price)]
  );
  const [row] = await query<any[]>(`${SELECT} WHERE pk.id = ?`, [result.insertId]);
  res.status(201).json(row);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });
  const { name, package_qty, package_price } = req.body;
  await query(
    'UPDATE packaging SET name = ?, package_qty = ?, package_price = ? WHERE id = ?',
    [String(name).trim(), Number(package_qty), Number(package_price), req.params.id]
  );
  const [row] = await query<any[]>(`${SELECT} WHERE pk.id = ?`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  res.json(row);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const [used] = await query<any[]>('SELECT COUNT(*) AS n FROM product_packaging WHERE packaging_id = ?', [req.params.id]);
  if (used.n > 0) {
    return res.status(409).json({ error: 'Ese packaging lo usan productos. Quitalo de esos productos antes de borrarlo.' });
  }
  await query('DELETE FROM packaging WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
