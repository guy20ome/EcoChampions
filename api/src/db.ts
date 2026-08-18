import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  host: config.MARIADB_HOST,
  port: config.MARIADB_PORT,
  database: config.MARIADB_DATABASE,
  user: config.MARIADB_USER,
  password: config.MARIADB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  decimalNumbers: true,
});

export async function assertDbReady(): Promise<void> {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}
