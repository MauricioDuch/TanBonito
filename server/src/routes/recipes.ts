import { Router } from 'express';
import { db, query } from '../config/db.js';
import { inTransaction } from '../config/stock.js';
import { asyncHandler } from '../middleware/middleware.js';
import { withCosts } from './products.js';

const router = Router();

// Recetas = productos que tienen al menos un ingrediente
router.get('/', asyncHandler(async (req, res) => {
  const products = await query<any[]>(
    'SELECT * FROM products WHERE id IN (SELECT DISTINCT product_id FROM recipe_items) ORDER BY name'
  );
  res.json(await withCosts(products));
}));

// Crear o actualizar la receta de un producto (reemplaza todos los ingredientes)
router.put('/:productId', asyncHandler(async (req, res) => {
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
  const rows = items
    .filter((i) => i.supply_id && Number(i.quantity) > 0)
    .map((i) => [Number(req.params.productId), Number(i.supply_id), Number(i.quantity)]);
  if (!rows.length) return res.status(400).json({ error: 'La receta necesita al menos un insumo con cantidad' });
  if (new Set(rows.map((r) => r[1])).size !== rows.length) {
    return res.status(400).json({ error: 'Hay un insumo repetido en la receta' });
  }

  const [product] = await query<any[]>('SELECT id FROM products WHERE id = ?', [req.params.productId]);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  await inTransaction(db, async (conn) => {
    await conn.query('DELETE FROM recipe_items WHERE product_id = ?', [req.params.productId]);
    await conn.query('INSERT INTO recipe_items (product_id, supply_id, quantity) VALUES ?', [rows]);
  });
  const [recipe] = await withCosts(await query<any[]>('SELECT * FROM products WHERE id = ?', [req.params.productId]));
  res.json(recipe);
}));

// Borra la receta (el producto queda, sin ingredientes)
router.delete('/:productId', asyncHandler(async (req, res) => {
  await query('DELETE FROM recipe_items WHERE product_id = ?', [req.params.productId]);
  res.json({ ok: true });
}));

export default router;
