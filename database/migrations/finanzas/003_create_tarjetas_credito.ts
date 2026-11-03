import { Pool } from 'mysql2/promise';
import { addColumnIfMissing, ampliarCheckConstraint } from './helpers';

/**
 * Tabla ya existente en la BD real. Columnas titular/tipo_titular/
 * vencimiento/uso/propiedad/prestada_por/notas son adiciones de esta
 * migración para cubrir TarjetaCredito de Flutter; `nombre` ya existía
 * y se usa como alias.
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tarjetas_credito (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      catalogo_id INT NOT NULL,
      nombre VARCHAR(80) NOT NULL,
      marca VARCHAR(20) NOT NULL,
      ultimos4 CHAR(4) NULL,
      cupo DECIMAL(12, 2) NOT NULL,
      dia_corte SMALLINT NULL,
      dia_pago SMALLINT NULL,
      tasa_anual_pct DECIMAL(7, 4) NULL,
      color VARCHAR(10) NOT NULL DEFAULT 'indigo',
      activa TINYINT(1) NOT NULL DEFAULT 1,
      titular VARCHAR(100) NULL,
      tipo_titular VARCHAR(20) NOT NULL DEFAULT 'principal',
      vencimiento VARCHAR(7) NULL,
      uso VARCHAR(20) NOT NULL DEFAULT 'personal',
      propiedad VARCHAR(20) NOT NULL DEFAULT 'propia',
      prestada_por VARCHAR(100) NULL,
      notas VARCHAR(255) NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tarjetas_usuario_id (usuario_id),
      INDEX idx_tarjetas_catalogo_id (catalogo_id),
      CONSTRAINT fk_tarjetas_catalogo FOREIGN KEY (catalogo_id) REFERENCES catalogos(id)
    );
  `);

  await addColumnIfMissing(pool, 'tarjetas_credito', 'titular', 'VARCHAR(100) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'tipo_titular', "VARCHAR(20) NOT NULL DEFAULT 'principal'");
  await addColumnIfMissing(pool, 'tarjetas_credito', 'vencimiento', 'VARCHAR(7) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'uso', "VARCHAR(20) NOT NULL DEFAULT 'personal'");
  await addColumnIfMissing(pool, 'tarjetas_credito', 'propiedad', "VARCHAR(20) NOT NULL DEFAULT 'propia'");
  await addColumnIfMissing(pool, 'tarjetas_credito', 'prestada_por', 'VARCHAR(100) NULL');
  await addColumnIfMissing(pool, 'tarjetas_credito', 'notas', 'VARCHAR(255) NULL');

  // MarcaTarjeta de Flutter incluye 'unionPay', que el CHECK original no permitía.
  // Desde la migración 016 las marcas viven en la tabla marcas_tarjeta y el
  // CHECK se elimina: si esa tabla ya existe no se vuelve a crear (si no,
  // correr `npm run migrate` completo lo re-agregaría y bloquearía marcas nuevas).
  const [mt] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marcas_tarjeta'`,
  );
  if ((mt as { total: number }[])[0].total > 0) return;
  await ampliarCheckConstraint(
    pool,
    'tarjetas_credito',
    'tarjetas_credito_chk_1',
    'unionPay',
    "marca in ('visa','mastercard','amex','diners','discover','unionPay')",
  );
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS tarjetas_credito;');
}
