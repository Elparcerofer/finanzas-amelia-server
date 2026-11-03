import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';
import { CATEGORIAS_TARJETA, MARCAS_TARJETA } from '../../seeds/finanzas/tarjetas_catalogos.data';

/**
 * Catálogos de tarjeta + campos del prototipo "Registrar tarjeta".
 *
 *  - marcas_tarjeta      (Visa, Mastercard, American Express, …)
 *  - categorias_tarjeta  (nivel: Clásica, Oro, Platinum, Black, …)
 *  - tarjetas_credito:
 *      marca_id → marcas_tarjeta (la columna `marca` en texto se mantiene,
 *        sincronizada con marcas_tarjeta.codigo, para no romper lecturas
 *        viejas; el CHECK con la lista fija se elimina porque ahora manda
 *        la tabla y se pueden agregar marcas nuevas).
 *      categoria_tarjeta_id → categorias_tarjeta
 *      costo_anual, callcenter, asesor, asesor_celular
 *      cuenta_debito_id → cuentas (débito automático; ON DELETE SET NULL)
 *
 * Idempotente: se puede correr varias veces.
 */

async function existe(pool: Pool, sql: string, params: unknown[]): Promise<boolean> {
  const [rows] = await pool.query(sql, params);
  return (rows as { total: number }[])[0].total > 0;
}

async function addFkIfMissing(pool: Pool, tabla: string, nombre: string, definicion: string): Promise<void> {
  const ya = await existe(
    pool,
    `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [tabla, nombre],
  );
  if (!ya) await pool.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nombre}\` ${definicion}`);
}

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marcas_tarjeta (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(20) NOT NULL,
      nombre VARCHAR(60) NOT NULL,
      orden SMALLINT NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_marcas_tarjeta_codigo (codigo),
      UNIQUE KEY uq_marcas_tarjeta_nombre (nombre)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categorias_tarjeta (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(20) NOT NULL,
      nombre VARCHAR(60) NOT NULL,
      orden SMALLINT NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_categorias_tarjeta_codigo (codigo),
      UNIQUE KEY uq_categorias_tarjeta_nombre (nombre)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Datos base (upsert por código: no duplica y corrige nombres/orden).
  for (const [i, m] of MARCAS_TARJETA.entries()) {
    await pool.query(
      `INSERT INTO marcas_tarjeta (codigo, nombre, orden) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), orden = VALUES(orden)`,
      [m.codigo, m.nombre, i + 1],
    );
  }
  for (const [i, c] of CATEGORIAS_TARJETA.entries()) {
    await pool.query(
      `INSERT INTO categorias_tarjeta (codigo, nombre, orden) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), orden = VALUES(orden)`,
      [c.codigo, c.nombre, i + 1],
    );
  }

  // La lista fija de marcas pasa a la tabla: se quita el CHECK.
  const hayCheck = await existe(
    pool,
    `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tarjetas_credito'
       AND CONSTRAINT_NAME = 'tarjetas_credito_chk_1' AND CONSTRAINT_TYPE = 'CHECK'`,
    [],
  );
  if (hayCheck) await pool.query('ALTER TABLE tarjetas_credito DROP CHECK tarjetas_credito_chk_1');

  await addColumnIfMissing(pool, 'tarjetas_credito', 'marca_id', 'INT NULL AFTER marca');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'categoria_tarjeta_id', 'INT NULL AFTER marca_id');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'costo_anual', 'DECIMAL(12, 2) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'callcenter', 'VARCHAR(20) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'asesor', 'VARCHAR(100) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'asesor_celular', 'VARCHAR(20) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'cuenta_debito_id', 'INT NULL');

  // Las tarjetas existentes pasan de la marca en texto a la FK.
  await pool.query(
    `UPDATE tarjetas_credito t JOIN marcas_tarjeta m ON m.codigo = t.marca
     SET t.marca_id = m.id WHERE t.marca_id IS NULL`,
  );

  await addFkIfMissing(pool, 'tarjetas_credito', 'fk_tarjetas_marca',
    'FOREIGN KEY (marca_id) REFERENCES marcas_tarjeta(id)');
  await addFkIfMissing(pool, 'tarjetas_credito', 'fk_tarjetas_categoria_tarjeta',
    'FOREIGN KEY (categoria_tarjeta_id) REFERENCES categorias_tarjeta(id)');
  await addFkIfMissing(pool, 'tarjetas_credito', 'fk_tarjetas_cuenta_debito',
    'FOREIGN KEY (cuenta_debito_id) REFERENCES cuentas(id) ON DELETE SET NULL');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('ALTER TABLE tarjetas_credito DROP FOREIGN KEY fk_tarjetas_cuenta_debito');
  await pool.query('ALTER TABLE tarjetas_credito DROP FOREIGN KEY fk_tarjetas_categoria_tarjeta');
  await pool.query('ALTER TABLE tarjetas_credito DROP FOREIGN KEY fk_tarjetas_marca');
  for (const c of ['cuenta_debito_id', 'asesor_celular', 'asesor', 'callcenter', 'costo_anual', 'categoria_tarjeta_id', 'marca_id']) {
    await pool.query(`ALTER TABLE tarjetas_credito DROP COLUMN ${c}`);
  }
  await pool.query('DROP TABLE IF EXISTS categorias_tarjeta');
  await pool.query('DROP TABLE IF EXISTS marcas_tarjeta');
}
