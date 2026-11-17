import { PoolConnection } from 'mysql2/promise';

// Un movimiento dejaría el stock en negativo. Tirarla dentro de la transacción la revierte; responde 409.
export class StockError extends Error {}

// Movimientos de stock. Siempre dentro de una transacción (reciben la conexión).
// Los descuentos usan UPDATE ... WHERE stock alcanza: es atómico, dos operaciones a la vez no pueden pasarse.

export const moveProductStock = async (
  conn: PoolConnection, productId: number, scentId: number | null, delta: number,
  notEnough = 'No hay stock suficiente de ese producto'
) => {
  if (delta >= 0) {
    await conn.query(
      `INSERT INTO product_stock (product_id, scent_id, quantity) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [productId, scentId || 0, delta]
    );
    return;
  }
  const [result]: any = await conn.query(
    'UPDATE product_stock SET quantity = quantity + ? WHERE product_id = ? AND scent_id = ? AND quantity >= ?',
    [delta, productId, scentId || 0, -delta]
  );
  if (!result.affectedRows) throw new StockError(notEnough);
};

export const moveSupplyStock = async (
  conn: PoolConnection, supplyId: number, delta: number,
  notEnough = 'No hay stock suficiente de ese insumo'
) => {
  const amount = Number(delta.toFixed(3));
  const [result]: any = await conn.query(
    'UPDATE supplies SET stock = stock + ? WHERE id = ? AND stock + ? >= 0',
    [amount, supplyId, amount]
  );
  if (!result.affectedRows) throw new StockError(notEnough);
};

// Corre fn en una transacción y devuelve su resultado
export const inTransaction = async <T>(db: { getConnection: () => Promise<PoolConnection> }, fn: (conn: PoolConnection) => Promise<T>) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
