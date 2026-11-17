import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../middleware/middleware.js';
import { SUPPLY_SELECT } from './supplies.js';

const router = Router();

// Stock de productos agrupado por producto (secciones) y aroma, más el stock de insumos
router.get('/', asyncHandler(async (req, res) => {
  const rows = await query<any[]>(
    `SELECT p.id AS product_id, p.name AS product_name, p.active,
            ps.scent_id, COALESCE(sc.name, 'Sin aroma') AS scent_name, COALESCE(ps.quantity, 0) AS quantity
     FROM products p
     LEFT JOIN product_stock ps ON ps.product_id = p.id
     LEFT JOIN scents sc ON sc.id = ps.scent_id
     ORDER BY p.name, scent_name`
  );

  const products: any[] = [];
  for (const r of rows) {
    let section = products.find((p) => p.product_id === r.product_id);
    if (!section) {
      section = { product_id: r.product_id, name: r.product_name, active: r.active, total: 0, scents: [] };
      products.push(section);
    }
    // Las filas en 0 no aportan: se ocultan para que la lista quede limpia
    if (r.scent_id === null || r.quantity === 0) continue;
    section.scents.push({ scent_id: r.scent_id, name: r.scent_name, quantity: r.quantity });
    section.total += r.quantity;
  }

  res.json({ products, supplies: await query(`${SUPPLY_SELECT} ORDER BY s.name`) });
}));

// Ajuste manual (inventario inicial, roturas, regalos): fija la cantidad de un producto/aroma
router.put('/products', asyncHandler(async (req, res) => {
  const { product_id, scent_id } = req.body ?? {};
  const quantity = Number(req.body?.quantity);
  if (!product_id || !Number.isInteger(quantity)) return res.status(400).json({ error: 'Producto y cantidad entera requeridos' });
  if (quantity < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });
  await query(
    `INSERT INTO product_stock (product_id, scent_id, quantity) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
    [product_id, scent_id || 0, quantity]
  );
  res.json({ ok: true });
}));

// Ajuste manual del stock de un insumo
router.put('/supplies/:id', asyncHandler(async (req, res) => {
  const stock = Number(req.body?.stock);
  if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Stock inválido' });
  await query('UPDATE supplies SET stock = ? WHERE id = ?', [stock, req.params.id]);
  res.json({ ok: true });
}));

export default router;
