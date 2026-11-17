import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

// server/db/migrations, tanto desde src/config (tsx) como desde dist/config (build)
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

// Aplica en orden los .sql de db/migrations que todavía no corrieron. Cada archivo corre una sola vez.
export const runMigrations = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? 'tanbonito',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'tan_bonito',
    multipleStatements: true
  });
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const [rows]: any = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r: any) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`Aplicando migración ${file}...`);
      await conn.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    }
  } finally {
    await conn.end();
  }
};
