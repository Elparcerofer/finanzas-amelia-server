import { Pool } from 'mysql2/promise';
import { addColumnIfMissing, ampliarCheckConstraint, columnaExiste } from './helpers';

/**
 * Tabla ya existente en la BD real. alias/aviso_dias/categoria_id son
 * adiciones de esta migración para cubrir el modelo Deuda de Flutter.
 * `modo` (resumida/detallada) NO se guarda como columna: se deriva de
 * si existe una tabla_amortizacion vigente ligada a la deuda.
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deudas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      catalogo_id INT NULL,
      descripcion VARCHAR(255) NULL,
      monto_total DECIMAL(12, 2) NOT NULL,
      saldo_pendiente DECIMAL(12, 2) NOT NULL,
      tasa_interes DECIMAL(5, 4) NULL DEFAULT 0,
      fecha_inicio DATE NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      tipo_deuda VARCHAR(20) NOT NULL DEFAULT 'consumo',
      tarjeta_credito_id INT NULL,
      alias VARCHAR(150) NULL,
      aviso_dias TINYINT NOT NULL DEFAULT 3,
      categoria_id INT NULL,
      resumen_minimo DECIMAL(12, 2) NULL,
      resumen_corte DATE NULL,
      resumen_restantes_cuotas SMALLINT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deudas_usuario_id (usuario_id),
      INDEX idx_deudas_catalogo_id (catalogo_id),
      INDEX idx_deudas_tarjeta_credito_id (tarjeta_credito_id),
      INDEX idx_deudas_categoria_id (categoria_id),
      CONSTRAINT fk_deudas_catalogo FOREIGN KEY (catalogo_id) REFERENCES catalogos(id),
      CONSTRAINT fk_deudas_tarjeta FOREIGN KEY (tarjeta_credito_id) REFERENCES tarjetas_credito(id),
      CONSTRAINT fk_deudas_categoria FOREIGN KEY (categoria_id) REFERENCES catalogos(id)
    );
  `);

  await addColumnIfMissing(pool, 'deudas', 'alias', 'VARCHAR(150) NULL');
  await addColumnIfMissing(pool, 'deudas', 'aviso_dias', 'TINYINT NOT NULL DEFAULT 3');
  await addColumnIfMissing(pool, 'deudas', 'categoria_id', 'INT NULL');
  await addColumnIfMissing(pool, 'deudas', 'resumen_minimo', 'DECIMAL(12, 2) NULL');
  await addColumnIfMissing(pool, 'deudas', 'resumen_corte', 'DATE NULL');
  await addColumnIfMissing(pool, 'deudas', 'resumen_restantes_cuotas', 'SMALLINT NULL');
  // Desde la migración 019 la columna se llama acreedor_id.
  if (await columnaExiste(pool, 'deudas', 'catalogo_id')) {
    await pool.query('ALTER TABLE deudas MODIFY COLUMN catalogo_id INT NULL');
  }

  // TipoCredito de Flutter tiene 8 valores (tarjeta/consumo/capital/vehicular/
  // hipotecario/garantia/empresarial/suscripcion); el CHECK original solo
  // permitía 5 con otros nombres (tarjeta_credito/consumo/vehicular/
  // hipotecario/credito_comercial). Se amplía para guardar el valor tal
  // cual lo manda Flutter (sin tabla de traducción intermedia).
  await ampliarCheckConstraint(
    pool,
    'deudas',
    'deudas_chk_2',
    'capital',
    "tipo_deuda in ('tarjeta','consumo','capital','vehicular','hipotecario','garantia','empresarial','suscripcion')",
  );
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS deudas;');
}
