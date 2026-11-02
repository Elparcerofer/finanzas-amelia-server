import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * Tabla ya existente en la BD real. seg_desgravamen_tipo/valor y
 * otros_seguros son adiciones para cubrir ParametrosAmortizacion de
 * Flutter.
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tablas_amortizacion (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deuda_id INT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      monto_financiado DECIMAL(12, 2) NOT NULL,
      tasa_anual_pct DECIMAL(7, 4) NOT NULL,
      plazo_meses SMALLINT NOT NULL,
      fecha_inicio DATE NOT NULL,
      metodo_cuota VARCHAR(10) NOT NULL DEFAULT 'fijo',
      es_vigente TINYINT(1) NOT NULL DEFAULT 1,
      seg_desgravamen_tipo VARCHAR(12) NOT NULL DEFAULT 'fijo',
      seg_desgravamen_valor DECIMAL(10, 2) NOT NULL DEFAULT 0,
      otros_seguros DECIMAL(10, 2) NOT NULL DEFAULT 0,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tablas_amortizacion_deuda_id (deuda_id),
      CONSTRAINT fk_tablas_amortizacion_deuda FOREIGN KEY (deuda_id) REFERENCES deudas(id) ON DELETE CASCADE
    );
  `);

  await addColumnIfMissing(pool, 'tablas_amortizacion', 'seg_desgravamen_tipo', "VARCHAR(12) NOT NULL DEFAULT 'fijo'");
  await addColumnIfMissing(pool, 'tablas_amortizacion', 'seg_desgravamen_valor', 'DECIMAL(10, 2) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'tablas_amortizacion', 'otros_seguros', 'DECIMAL(10, 2) NOT NULL DEFAULT 0');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS tablas_amortizacion;');
}
