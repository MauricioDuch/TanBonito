import { Router } from 'express';
import { PoolConnection } from 'mysql2/promise';
import { db, query } from '../config/db.js';
import { inTransaction, moveProductStock, StockError } from '../config/stock.js';
import { asyncHandler, missing } from '../middleware/middleware.js';

const router = Router();

export const PAYMENT_METHODS = ['efectivo', 'mercadopago', 'tarjeta', 'transferencia'];
export const CHANNELS = ['feria', 'online'];
const REQUIRED = ['sale_date', 'product_id', 'quantity', 'unit_price', 'payment_method'];

// Filtro común ?from=YYYY-MM-DD&to=YYYY-MM-DD (por defecto, el mes actual)
export const dateRange = (q: any) => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: typeof q.from === 'string' && q.from ? q.from : today.slice(0, 8) + '01',
    to: typeof q.to === 'string' && q.to ? q.to : today
  };
};

const validate = (s: any) => {
  const absent = missing(s, REQUIRED);
  if (absent) return `Falta el campo ${absent}`;
  if (!PAYMENT_METHODS.includes(s.payment_method)) return 'Medio de pago inválido';
  if (s.channel && !CHANNELS.includes(s.channel)) return 'Canal inválido';
  if (!Number.isInteger(Number(s.quantity)) || Number(s.quantity) <= 0) return 'La cantidad debe ser un entero mayor a 0';
  return null;
};

router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  res.json(await query(
    `SELECT s.*, p.name AS product_name, sc.name AS scent_name
     FROM sales s JOIN products p ON p.id = s.product_id LEFT JOIN scents sc ON sc.id = s.scent_id
     WHERE s.sale_date BETWEEN ? AND ? ORDER BY s.sale_date DESC, s.id DESC`,
    [from, to]
  ));
}));

// Revisa todo el lote junto (el mismo producto puede venir en varias filas) y bloquea esas filas de stock.
// Si algo no alcanza, avisa de todos los faltantes de una vez y no se guarda ninguna venta.
const assertStock = async (conn: PoolConnection, list: any[]) => {
  const wanted = new Map<string, { productId: number; scentId: number; quantity: number }>();
  for (const s of list) {
    const productId = Number(s.product_id);
    const scentId = Number(s.scent_id) || 0;
    const key = `${productId}|${scentId}`;
    const entry = wanted.get(key) ?? { productId, scentId, quantity: 0 };
    entry.quantity += Number(s.quantity);
    wanted.set(key, entry);
  }

  const shortages: string[] = [];
  // En orden fijo, para que dos cargas a la vez no se traben entre sí
  for (const key of [...wanted.keys()].sort()) {
    const { productId, scentId, quantity } = wanted.get(key)!;
    const [[row]]: any = await conn.query(
      `SELECT p.name, sc.name AS scent_name, COALESCE(ps.quantity, 0) AS available
       FROM products p
       LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.scent_id = ?
       LEFT JOIN scents sc ON sc.id = ?
       WHERE p.id = ? FOR UPDATE`,
      [scentId, scentId, productId]
    );
    if (!row) throw new StockError('Ese producto ya no existe');
    if (row.available < quantity) {
      shortages.push(`${row.name} (${row.scent_name ?? 'Sin aroma'}): querés vender ${quantity}, hay ${row.available}`);
    }
  }
  if (shortages.length) throw new StockError(`No hay stock suficiente. ${shortages.join('. ')}.`);
};

// Acepta una venta o una lista (carga de los lunes desde el cuaderno de feria).
// Cada venta descuenta del stock del producto/aroma; no se puede vender más de lo que hay.
router.post('/', asyncHandler(async (req, res) => {
  const list: any[] = Array.isArray(req.body) ? req.body : [req.body];
  if (!list.length) return res.status(400).json({ error: 'No hay ventas para guardar' });
  for (const [i, s] of list.entries()) {
    const error = validate(s);
    if (error) return res.status(400).json({ error: list.length > 1 ? `Fila ${i + 1}: ${error}` : error });
  }
  await inTransaction(db, async (conn) => {
    await assertStock(conn, list);
    await conn.query(
      'INSERT INTO sales (sale_date, product_id, scent_id, quantity, unit_price, payment_method, channel) VALUES ?',
      [list.map((s) => [s.sale_date, s.product_id, s.scent_id || null, s.quantity, s.unit_price, s.payment_method, s.channel || 'feria'])]
    );
    for (const s of list) await moveProductStock(conn, Number(s.product_id), s.scent_id || null, -Number(s.quantity));
  });
  res.status(201).json({ created: list.length });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });
  const s = req.body;
  const found = await inTransaction(db, async (conn) => {
    const [[old]]: any = await conn.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!old) return false;
    // Devuelve lo de la venta original y descuenta lo de la corregida
    await moveProductStock(conn, old.product_id, old.scent_id, old.quantity);
    await conn.query(
      `UPDATE sales SET sale_date = ?, product_id = ?, scent_id = ?, quantity = ?, unit_price = ?, payment_method = ?, channel = ?
       WHERE id = ?`,
      [s.sale_date, s.product_id, s.scent_id || null, s.quantity, s.unit_price, s.payment_method, s.channel || 'feria', req.params.id]
    );
    await moveProductStock(conn, Number(s.product_id), s.scent_id || null, -Number(s.quantity));
    return true;
  });
  if (!found) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
}));

// Borrar una venta devuelve las unidades al stock
router.delete('/:id', asyncHandler(async (req, res) => {
  await inTransaction(db, async (conn) => {
    const [[old]]: any = await conn.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!old) return;
    await moveProductStock(conn, old.product_id, old.scent_id, old.quantity);
    await conn.query('DELETE FROM sales WHERE id = ?', [req.params.id]);
  });
  res.json({ ok: true });
}));

export default router;
