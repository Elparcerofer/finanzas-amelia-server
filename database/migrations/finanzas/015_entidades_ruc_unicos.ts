import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * Entidades financieras (catalogos.tipo = 'banco'):
 *  - agrega `ruc` (13 dígitos, opcional) — la estructura pedida para la
 *    entidad es: tipo (subtipo), código, nombre, RUC y estado (activo).
 *  - agrega índices únicos para que ni el seed ni la pantalla puedan
 *    crear registros repetidos:
 *      uq_catalogos_tipo_nombre  (tipo, nombre)  — la collation
 *        utf8mb4_unicode_ci ya compara sin mayúsculas ni tildes, así que
 *        "Banco Pacifico" choca con "Banco del Pacífico" solo si el
 *        nombre es igual salvo tildes/mayúsculas.
 *      uq_catalogos_tipo_codigo  (tipo, codigo)  — codigo NULL no choca
 *        (MySQL permite varios NULL en un índice único).
 *
 * Idempotente: se puede correr varias veces.
 */
async function addIndexIfMissing(pool: Pool, tabla: string, indice: string, definicion: string): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tabla, indice],
  );
  if ((rows as { total: number }[])[0].total > 0) return;
  await pool.query(`ALTER TABLE \`${tabla}\` ADD ${definicion}`);
}

export async function up(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'catalogos', 'ruc', 'VARCHAR(13) NULL AFTER codigo');
  await addIndexIfMissing(pool, 'catalogos', 'uq_catalogos_tipo_nombre', 'UNIQUE KEY uq_catalogos_tipo_nombre (tipo, nombre)');
  await addIndexIfMissing(pool, 'catalogos', 'uq_catalogos_tipo_codigo', 'UNIQUE KEY uq_catalogos_tipo_codigo (tipo, codigo)');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('ALTER TABLE catalogos DROP INDEX uq_catalogos_tipo_codigo');
  await pool.query('ALTER TABLE catalogos DROP INDEX uq_catalogos_tipo_nombre');
  await pool.query('ALTER TABLE catalogos DROP COLUMN ruc');
}
