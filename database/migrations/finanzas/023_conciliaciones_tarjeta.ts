import { Pool } from 'mysql2/promise';

/**
 * "Consumos y conciliación" del prototipo Solvenza (tarjeta detallada):
 *
 *  conciliaciones_tarjeta  una fila por deuda de tarjeta y período
 *                          (YYYY-MM): valor del estado de cuenta, lo que
 *                          realmente se pagó y su fecha, y los montos
 *                          leídos del PDF (el PDF y su clave no se guardan).
 *  conciliaciones_items    consumos / cuotas marcados como conciliados
 *                          (item_clave = <consumo>, <consumo>#<n> o
 *                          <consumo>#liq, igual que el motor).
 *
 * Idempotente.
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conciliaciones_tarjeta (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      deuda_id INT NOT NULL,
      periodo CHAR(7) NOT NULL,
      valor_estado DECIMAL(30, 2) NULL,
      pago_real DECIMAL(30, 2) NULL,
      fecha_pago DATE NULL,
      pdf_nombre VARCHAR(255) NULL,
      pdf_montos JSON NULL,
      pdf_sugeridos JSON NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_conciliaciones_deuda_periodo (deuda_id, periodo),
      INDEX idx_conciliaciones_usuario (usuario_id),
      CONSTRAINT fk_conciliaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      CONSTRAINT fk_conciliaciones_deuda FOREIGN KEY (deuda_id) REFERENCES deudas(id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conciliaciones_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conciliacion_id INT NOT NULL,
      item_clave VARCHAR(40) NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_conciliaciones_items (conciliacion_id, item_clave),
      CONSTRAINT fk_conciliaciones_items FOREIGN KEY (conciliacion_id) REFERENCES conciliaciones_tarjeta(id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS conciliaciones_items');
  await pool.query('DROP TABLE IF EXISTS conciliaciones_tarjeta');
}
