import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../middleware/middleware.js';
import { dateRange } from './sales.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  const range = [from, to];
  const where = 'WHERE s.sale_date BETWEEN ? AND ?';

  const [[totals], topProducts, topScents, byChannel, byPayment, [{ purchases }]] = await Promise.all([
    query<any[]>(`SELECT COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(quantity), 0) AS units, COUNT(*) AS sales
                  FROM sales s ${where}`, range),
    query<any[]>(`SELECT p.name, SUM(s.quantity) AS units, SUM(s.total) AS revenue
                  FROM sales s JOIN products p ON p.id = s.product_id ${where}
                  GROUP BY p.id, p.name ORDER BY units DESC`, range),
    query<any[]>(`SELECT COALESCE(sc.name, 'Sin aroma') AS name, SUM(s.quantity) AS units, SUM(s.total) AS revenue
                  FROM sales s LEFT JOIN scents sc ON sc.id = s.scent_id ${where}
                  GROUP BY sc.id, sc.name ORDER BY units DESC`, range),
    query<any[]>(`SELECT channel AS name, SUM(quantity) AS units, SUM(total) AS revenue
                  FROM sales s ${where} GROUP BY channel ORDER BY revenue DESC`, range),
    query<any[]>(`SELECT payment_method AS name, SUM(quantity) AS units, SUM(total) AS revenue
                  FROM sales s ${where} GROUP BY payment_method ORDER BY revenue DESC`, range),
    query<any[]>('SELECT COALESCE(SUM(price), 0) AS purchases FROM purchases WHERE purchase_date BETWEEN ? AND ?', range)
  ]);

  res.json({ from, to, ...totals, purchases, topProducts, topScents, byChannel, byPayment });
}));

// Ventas por mes: los 12 meses que terminan en el mes de ?to (por defecto, el actual). Los meses sin ventas van en 0.
router.get('/monthly', asyncHandler(async (req, res) => {
  const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}/.test(req.query.to)
    ? req.query.to.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  const [year, month] = to.split('-').map(Number);

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const rows = await query<any[]>(
    `SELECT DATE_FORMAT(sale_date, '%Y-%m') AS month, SUM(total) AS revenue, SUM(quantity) AS units
     FROM sales WHERE sale_date BETWEEN ? AND LAST_DAY(?) GROUP BY month`,
    [`${months[0]}-01`, `${to}-01`]
  );
  res.json(months.map((m) => {
    const r = rows.find((x) => x.month === m);
    return { month: m, revenue: Number(r?.revenue ?? 0), units: Number(r?.units ?? 0) };
  }));
}));

export default router;
