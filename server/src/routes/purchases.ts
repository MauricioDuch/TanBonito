import { Router } from 'express';
import { db, query } from '../config/db.js';
import { inTransaction, moveSupplyStock } from '../config/stock.js';
import { asyncHandler, missing } from '../middleware/middleware.js';
import { dateRange } from './sales.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  res.json(await query(
    `SELECT pu.*, s.name AS supply_name, s.unit, sp.name AS supplier_name
     FROM purchases pu JOIN supplies s ON s.id = pu.supply_id LEFT JOIN suppliers sp ON sp.id = pu.supplier_id
     WHERE pu.purchase_date BETWEEN ? AND ? ORDER BY pu.purchase_date DESC, pu.id DESC`,
    [from, to]
  ));
}));

// La compra suma al stock del insumo. Con update_supply = true, además pasa a ser su precio de referencia.
router.post('/', asyncHandler(async (req, res) => {
  const b = req.body;
  const absent = missing(b, ['purchase_date', 'supply_id', 'quantity', 'price']);
  if (absent) return res.status(400).json({ error: `Falta el campo ${absent}` });
  if (!(Number(b.quantity) > 0)) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

  const id = await inTransaction(db, async (conn) => {
    const [result]: any = await conn.query(
      'INSERT INTO purchases (purchase_date, supply_id, quantity, price, supplier_id) VALUES (?, ?, ?, ?, ?)',
      [b.purchase_date, b.supply_id, b.quantity, b.price, b.supplier_id || null]
    );
    await moveSupplyStock(conn, Number(b.supply_id), Number(b.quantity));
    if (b.update_supply) {
      await conn.query(
        'UPDATE supplies SET package_qty = ?, package_price = ?, supplier_id = COALESCE(?, supplier_id) WHERE id = ?',
        [b.quantity, b.price, b.supplier_id || null, b.supply_id]
      );
    }
    return result.insertId;
  });
  res.status(201).json({ id });
}));

// Borrar una compra saca esa cantidad del stock del insumo
router.delete('/:id', asyncHandler(async (req, res) => {
  await inTransaction(db, async (conn) => {
    const [[old]]: any = await conn.query('SELECT * FROM purchases WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!old) return;
    await moveSupplyStock(
      conn, old.supply_id, -Number(old.quantity),
      'No se puede borrar la compra: parte de ese insumo ya se usó y el stock quedaría negativo.'
    );
    await conn.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
  });
  res.json({ ok: true });
}));

export default router;
