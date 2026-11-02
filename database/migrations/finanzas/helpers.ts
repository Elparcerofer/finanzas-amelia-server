import { Pool } from 'mysql2/promise';

/**
 * MySQL (a diferencia de MariaDB) no soporta `ALTER TABLE ... ADD COLUMN
 * IF NOT EXISTS`. Se verifica contra information_schema antes de alterar
 * para que las migraciones sigan siendo idempotentes.
 */
export async function addColumnIfMissing(
  pool: Pool,
  tabla: string,
  columna: string,
  definicionColumna: string,
): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna],
  );
  const total = (rows as { total: number }[])[0].total;
  if (total > 0) {
    return;
  }
  await pool.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicionColumna}`);
}

/**
 * Reemplaza un CHECK constraint por uno nuevo, solo si el actual no
 * incluye ya `valorRequerido` (idempotente). MySQL no soporta
 * `ALTER TABLE ... ALTER CHECK`, hay que DROP + ADD.
 */
export async function ampliarCheckConstraint(
  pool: Pool,
  tabla: string,
  constraintName: string,
  valorRequerido: string,
  nuevaExpresion: string,
): Promise<void> {
  const [rows] = await pool.query(
    `SELECT CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`,
    [constraintName],
  );
  const fila = (rows as { CHECK_CLAUSE: string }[])[0];
  if (fila && fila.CHECK_CLAUSE.includes(valorRequerido)) {
    return;
  }
  if (fila) {
    await pool.query(`ALTER TABLE \`${tabla}\` DROP CHECK \`${constraintName}\``);
  }
  await pool.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${constraintName}\` CHECK (${nuevaExpresion})`);
}
