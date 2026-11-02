import { Pool } from 'mysql2/promise';

/** Tabla ya existente en la BD real — sin cambios, se documenta para instalaciones nuevas. */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estados_cuenta (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deuda_id INT NOT NULL,
      periodo DATE NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      monto_calculado DECIMAL(12, 2) NOT NULL DEFAULT 0,
      monto_estado DECIMAL(12, 2) NULL,
      pago_minimo DECIMAL(12, 2) NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_estados_cuenta_deuda_id (deuda_id),
      CONSTRAINT fk_estados_cuenta_deuda FOREIGN KEY (deuda_id) REFERENCES deudas(id) ON DELETE CASCADE
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS estados_cuenta;');
}
