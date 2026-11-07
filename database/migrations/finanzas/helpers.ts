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

async function contar(pool: Pool, sql: string, params: unknown[]): Promise<number> {
  const [rows] = await pool.query(sql, params);
  return Number((rows as { total: number }[])[0].total);
}

export async function columnaExiste(pool: Pool, tabla: string, columna: string): Promise<boolean> {
  return (await contar(
    pool,
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna],
  )) > 0;
}

export async function addIndexIfMissing(pool: Pool, tabla: string, indice: string, columnas: string): Promise<void> {
  const ya = await contar(
    pool,
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tabla, indice],
  );
  if (!ya) await pool.query(`ALTER TABLE \`${tabla}\` ADD INDEX \`${indice}\` (${columnas})`);
}

export async function addFkIfMissing(pool: Pool, tabla: string, nombre: string, definicion: string): Promise<void> {
  const ya = await contar(
    pool,
    `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [tabla, nombre],
  );
  if (!ya) await pool.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nombre}\` ${definicion}`);
}

export async function addCheckIfMissing(pool: Pool, tabla: string, nombre: string, expresion: string): Promise<void> {
  const ya = await contar(
    pool,
    `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'`,
    [tabla, nombre],
  );
  if (!ya) await pool.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nombre}\` CHECK (${expresion})`);
}

/**
 * Elimina las FKs de `tabla.columna`. Si se pasa `salvoHacia`, conserva
 * las que ya apuntan a esa tabla. Los nombres se leen de
 * information_schema porque en la BD real (creada antes de estas
 * migraciones) pueden ser los automáticos de MySQL (`<tabla>_ibfk_N`).
 */
export async function dropForeignKeysOnColumn(pool: Pool, tabla: string, columna: string, salvoHacia?: string): Promise<void> {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME AS nombre, REFERENCED_TABLE_NAME AS destino FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [tabla, columna],
  );
  for (const fk of rows as { nombre: string; destino: string }[]) {
    if (salvoHacia && fk.destino === salvoHacia) continue;
    await pool.query(`ALTER TABLE \`${tabla}\` DROP FOREIGN KEY \`${fk.nombre}\``);
  }
}

/** MySQL 8 no deja borrar/renombrar una columna usada por un CHECK: se quitan antes. */
export async function dropChecksOnColumn(pool: Pool, tabla: string, columna: string): Promise<void> {
  const [rows] = await pool.query(
    `SELECT cc.CONSTRAINT_NAME AS nombre, cc.CHECK_CLAUSE AS clausula
     FROM information_schema.CHECK_CONSTRAINTS cc
     JOIN information_schema.TABLE_CONSTRAINTS tc
       ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
     WHERE cc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = ?`,
    [tabla],
  );
  for (const ck of rows as { nombre: string; clausula: string }[]) {
    if (new RegExp(`\\b${columna}\\b`).test(ck.clausula)) {
      await pool.query(`ALTER TABLE \`${tabla}\` DROP CHECK \`${ck.nombre}\``);
    }
  }
}

/**
 * MODIFY de una columna solo si su tipo actual no es `tipoEsperado`
 * (ej. 'decimal(30,2)'), para no reconstruir la tabla en cada corrida.
 */
export async function asegurarTipoColumna(
  pool: Pool,
  tabla: string,
  columna: string,
  tipoEsperado: string,
  definicion: string,
): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna],
  );
  const fila = (rows as { tipo: string }[])[0];
  if (!fila || fila.tipo.toLowerCase().replace(/\s/g, '') === tipoEsperado.toLowerCase().replace(/\s/g, '')) return;
  await pool.query(`ALTER TABLE \`${tabla}\` MODIFY COLUMN \`${columna}\` ${definicion}`);
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
