import { Router } from 'express';
import { PoolConnection } from 'mysql2/promise';
import { db, query } from '../config/db.js';
import { inTransaction, moveProductStock, moveSupplyStock } from '../config/stock.js';
import { asyncHandler, missing } from '../middleware/middleware.js';
import { getSettings } from './settings.js';

const router = Router();

const round = (n: number) => Math.round(n * 100) / 100;

// Costo por unidad = insumos + mano de obra + packaging + gastos fijos prorrateados
export const withCosts = async (products: any[]) => {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const items = await query<any[]>(
    `SELECT ri.product_id, ri.supply_id, ri.quantity, s.name AS supply_name, s.unit, s.stock,
            s.package_price / s.package_qty AS unit_price
     FROM recipe_items ri JOIN supplies s ON s.id = ri.supply_id
     WHERE ri.product_id IN (?) ORDER BY s.name`,
    [ids]
  );
  const packagingItems = await query<any[]>(
    `SELECT pp.product_id, pp.packaging_id, pp.quantity, pk.name AS packaging_name,
            pk.package_price / pk.package_qty AS unit_price
     FROM product_packaging pp JOIN packaging pk ON pk.id = pp.packaging_id
     WHERE pp.product_id IN (?) ORDER BY pk.name`,
    [ids]
  );
  const stock = await query<any[]>(
    'SELECT product_id, SUM(quantity) AS stock FROM product_stock WHERE product_id IN (?) GROUP BY product_id',
    [ids]
  );
  const [{ fixed_total }] = await query<any[]>('SELECT COALESCE(SUM(monthly_amount), 0) AS fixed_total FROM fixed_expenses');
  const { margin_percent, monthly_units } = await getSettings();
  const fixedPerUnit = monthly_units > 0 ? fixed_total / monthly_units : 0;

  return products.map((p) => {
    const recipe = items
      .filter((i) => i.product_id === p.id)
      .map((i) => ({ ...i, unit_price: round(i.unit_price), cost: round(i.quantity * i.unit_price) }));
    const supplies_cost = round(recipe.reduce((sum, i) => sum + i.cost, 0));
    const packaging = packagingItems
      .filter((i) => i.product_id === p.id)
      .map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: round(i.unit_price), cost: round(i.quantity * i.unit_price) }));
    const packaging_cost = round(packaging.reduce((sum, i) => sum + i.cost, 0));
    const total_cost = round(supplies_cost + p.labor_cost + packaging_cost + fixedPerUnit);
    return {
      ...p,
      recipe,
      packaging,
      packaging_cost,
      stock: Number(stock.find((s) => s.product_id === p.id)?.stock ?? 0),
      supplies_cost,
      fixed_cost: round(fixedPerUnit),
      total_cost,
      suggested_price: round(total_cost * (1 + margin_percent / 100)),
      margin: p.sale_price > 0 ? round(((p.sale_price - total_cost) / p.sale_price) * 100) : null
    };
  });
};

const getProduct = async (id: number | string) =>
  (await withCosts(await query<any[]>('SELECT * FROM products WHERE id = ?', [id])))[0];

router.get('/', asyncHandler(async (req, res) => {
  const onlyActive = req.query.active === '1' ? 'WHERE active = 1' : '';
  res.json(await withCosts(await query<any[]>(`SELECT * FROM products ${onlyActive} ORDER BY name`)));
}));

// Últimas fabricaciones (para ver qué se hizo y poder deshacer un error)
router.get('/productions', asyncHandler(async (req, res) => {
  res.json(await query(
    `SELECT pr.*, p.name AS product_name, p.category, sc.name AS scent_name
     FROM productions pr JOIN products p ON p.id = pr.product_id LEFT JOIN scents sc ON sc.id = pr.scent_id
     ORDER BY pr.id DESC LIMIT 20`
  ));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const product = await getProduct(String(req.params.id));
  if (!product) return res.status(404).json({ error: 'No encontrado' });
  res.json(product);
}));

const values = (b: any) => [
  b.name, b.category === 'aroma' ? 'aroma' : 'vela', b.labor_cost ?? 0, b.sale_price ?? 0, b.active ?? 1
];

// packaging: [{ packaging_id, quantity }]. Si viene, reemplaza todo el packaging del producto.
const packagingRows = (b: any): { rows: number[][] } | { error: string } | null => {
  if (b.packaging === undefined) return null;
  if (!Array.isArray(b.packaging)) return { error: 'Packaging inválido' };
  const rows = b.packaging
    .filter((i: any) => i.packaging_id && Number(i.quantity) > 0)
    .map((i: any) => [Number(i.packaging_id), Number(i.quantity)]);
  if (new Set(rows.map((r: number[]) => r[0])).size !== rows.length) return { error: 'Hay un packaging repetido' };
  return { rows };
};

const savePackaging = async (conn: PoolConnection, productId: number, rows: number[][]) => {
  await conn.query('DELETE FROM product_packaging WHERE product_id = ?', [productId]);
  if (rows.length) {
    await conn.query('INSERT INTO product_packaging (product_id, packaging_id, quantity) VALUES ?', [rows.map((r) => [productId, ...r])]);
  }
};

router.post('/', asyncHandler(async (req, res) => {
  if (missing(req.body, ['name'])) return res.status(400).json({ error: 'Falta el nombre' });
  const pack = packagingRows(req.body);
  if (pack && 'error' in pack) return res.status(400).json({ error: pack.error });
  const id = await inTransaction(db, async (conn) => {
    const [result]: any = await conn.query(
      'INSERT INTO products (name, category, labor_cost, sale_price, active) VALUES (?, ?, ?, ?, ?)',
      values(req.body)
    );
    if (pack) await savePackaging(conn, result.insertId, pack.rows);
    return result.insertId;
  });
  res.status(201).json(await getProduct(id));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (missing(req.body, ['name'])) return res.status(400).json({ error: 'Falta el nombre' });
  const pack = packagingRows(req.body);
  if (pack && 'error' in pack) return res.status(400).json({ error: pack.error });
  await inTransaction(db, async (conn) => {
    await conn.query(
      'UPDATE products SET name = ?, category = ?, labor_cost = ?, sale_price = ?, active = ? WHERE id = ?',
      [...values(req.body), req.params.id]
    );
    if (pack) await savePackaging(conn, Number(req.params.id), pack.rows);
  });
  const product = await getProduct(String(req.params.id));
  if (!product) return res.status(404).json({ error: 'No encontrado' });
  res.json(product);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await query('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// Fabricar: aplica la receta × cantidad, descuenta insumos y suma el producto al stock.
// Si falta algún insumo no toca nada y devuelve 409 con la lista de faltantes.
router.post('/:id/produce', asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const quantity = Number(req.body?.quantity);
  const scentId = req.body?.scent_id ? Number(req.body.scent_id) : 0;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor a 0' });
  }

  const outcome = await inTransaction(db, async (conn) => {
    // FOR UPDATE: bloquea los insumos para que dos fabricaciones a la vez no usen el mismo stock
    const [items]: any = await conn.query(
      `SELECT ri.supply_id, ri.quantity * ? AS needed, s.name, s.unit, s.stock AS available
       FROM recipe_items ri JOIN supplies s ON s.id = ri.supply_id
       WHERE ri.product_id = ? FOR UPDATE`,
      [quantity, productId]
    );
    if (!items.length) return { status: 400, body: { error: 'Este producto no tiene receta. Cargala en la solapa Recetas.' } };

    const shortages = items
      .filter((i: any) => i.available < i.needed)
      .map((i: any) => ({
        supply_id: i.supply_id, name: i.name, unit: i.unit,
        needed: round(i.needed), available: round(i.available), missing: round(i.needed - i.available)
      }));
    if (shortages.length) {
      return { status: 409, body: { error: 'No alcanzan los insumos', missing: shortages } };
    }

    const [result]: any = await conn.query(
      'INSERT INTO productions (product_id, scent_id, quantity) VALUES (?, ?, ?)',
      [productId, scentId, quantity]
    );
    for (const i of items) {
      await moveSupplyStock(conn, i.supply_id, -i.needed);
      await conn.query('INSERT INTO production_items (production_id, supply_id, quantity) VALUES (?, ?, ?)', [result.insertId, i.supply_id, i.needed]);
    }
    await moveProductStock(conn, productId, scentId, quantity);
    return { status: 201, body: { id: result.insertId, used: items.map((i: any) => ({ name: i.name, unit: i.unit, quantity: round(i.needed) })) } };
  });

  res.status(outcome.status).json(outcome.body);
}));

// Deshacer una fabricación: devuelve los insumos y saca las unidades del stock
router.delete('/productions/:productionId', asyncHandler(async (req, res) => {
  const done = await inTransaction(db, async (conn) => {
    const [[production]]: any = await conn.query('SELECT * FROM productions WHERE id = ? FOR UPDATE', [req.params.productionId]);
    if (!production) return false;
    const [items]: any = await conn.query('SELECT * FROM production_items WHERE production_id = ?', [production.id]);
    for (const i of items) await moveSupplyStock(conn, i.supply_id, Number(i.quantity));
    await moveProductStock(
      conn, production.product_id, production.scent_id, -production.quantity,
      'No se puede deshacer: esas unidades ya no están en stock (se vendieron o se ajustaron).'
    );
    await conn.query('DELETE FROM productions WHERE id = ?', [production.id]);
    return true;
  });
  if (!done) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
}));

export default router;
