import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  // La base es remota: las conexiones que quedan ociosas en el pool las
  // corta el servidor/red y la siguiente consulta que las reusa falla con
  // "read ECONNRESET" (visto en la app al volver a Catálogos tras unos
  // minutos sin uso). Keep-alive TCP + cerrar las ociosas antes de que
  // las corten evita reusar sockets muertos.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 2,
  idleTimeout: 60000,
});

export default pool;
