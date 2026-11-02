import { Pool } from 'mysql2/promise';
import { addColumnIfMissing } from './helpers';

/**
 * Tabla ya existente en la BD real. `seguro` es adición de esta
 * migración: Flutter calcula cuota = capital + interes + seguro
 * (generarTablaAmortizacion) y la tabla original no tenía ese
 * desglose, solo total_cuota.
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cuotas_amortizacion (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tabla_amortizacion_id INT NOT NULL,
      numero_cuota SMALLINT NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      capital DECIMAL(12, 2) NOT NULL,
      interes DECIMAL(12, 2) NOT NULL,
      seguro DECIMAL(12, 2) NOT NULL DEFAULT 0,
      total_cuota DECIMAL(12, 2) NOT NULL,
      saldo_despues DECIMAL(12, 2) NOT NULL,
      liquidada TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_cuotas_amortizacion_tabla_id (tabla_amortizacion_id),
      INDEX idx_cuotas_amortizacion_fecha_vencimiento (fecha_vencimiento),
      CONSTRAINT fk_cuotas_amortizacion_tabla FOREIGN KEY (tabla_amortizacion_id) REFERENCES tablas_amortizacion(id) ON DELETE CASCADE
    );
  `);

  await addColumnIfMissing(pool, 'cuotas_amortizacion', 'seguro', 'DECIMAL(12, 2) NOT NULL DEFAULT 0');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS cuotas_amortizacion;');
}
