import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler, missing } from '../middleware/middleware.js';

interface CrudOptions {
  table: string;
  fields: string[];        // columnas editables
  required: string[];
  orderBy?: string;
}

// ABM genérico para tablas simples (proveedores, aromas, gastos fijos)
export const crudRouter = ({ table, fields, required, orderBy = 'id' }: CrudOptions) => {
  const router = Router();
  const pick = (body: any) => fields.filter((f) => body?.[f] !== undefined).map((f) => [f, body[f]] as const);

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await query(`SELECT * FROM ${table} ORDER BY ${orderBy}`));
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const absent = missing(req.body, required);
    if (absent) return res.status(400).json({ error: `Falta el campo ${absent}` });
    const values = pick(req.body);
    const result: any = await query(
      `INSERT INTO ${table} (${values.map(([f]) => f).join(', ')}) VALUES (${values.map(() => '?').join(', ')})`,
      values.map(([, v]) => v)
    );
    const [row] = await query<any[]>(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
    res.status(201).json(row);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const values = pick(req.body);
    if (!values.length) return res.status(400).json({ error: 'Nada para actualizar' });
    await query(
      `UPDATE ${table} SET ${values.map(([f]) => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...values.map(([, v]) => v), req.params.id]
    );
    const [row] = await query<any[]>(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    await query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  }));

  return router;
};
