import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER ?? 'tanbonito',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'tan_bonito',
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  // DECIMAL llega como número en vez de string
  decimalNumbers: true,
  dateStrings: true
});

// Atajo: devuelve solo las filas. Los errores se propagan al errorHandler vía asyncHandler.
export const query = async <T = any>(sql: string, params: any[] = []): Promise<T> => {
  const [rows] = await db.query(sql, params);
  return rows as T;
};

// Espera a que MySQL acepte conexiones (en Docker el contenedor de la base tarda en arrancar)
export const waitForDb = async (retries = 30) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await db.query('SELECT 1');
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`Esperando a MySQL (${i}/${retries})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
};
