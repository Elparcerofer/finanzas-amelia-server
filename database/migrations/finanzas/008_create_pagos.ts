import { Pool } from 'mysql2/promise';

/** Tabla ya existente en la BD real — sin cambios, se documenta para instalaciones nuevas. */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deuda_id INT NOT NULL,
      monto DECIMAL(12, 2) NOT NULL,
      fecha_pago DATE NOT NULL,
      metodo_pago VARCHAR(20) NOT NULL,
      comprobante VARCHAR(255) NULL,
      cuota_id INT NULL,
      estado_cuenta_id INT NULL,
      parte_capital DECIMAL(12, 2) NOT NULL DEFAULT 0,
      parte_interes DECIMAL(12, 2) NOT NULL DEFAULT 0,
      parte_recargos DECIMAL(12, 2) NOT NULL DEFAULT 0,
      estado VARCHAR(10) NOT NULL DEFAULT 'registrado',
      anulado_en TIMESTAMP NULL,
      motivo_anulacion VARCHAR(255) NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pagos_deuda_id (deuda_id),
      INDEX idx_pagos_cuota_id (cuota_id),
      INDEX idx_pagos_estado_cuenta_id (estado_cuenta_id),
      CONSTRAINT fk_pagos_deuda FOREIGN KEY (deuda_id) REFERENCES deudas(id) ON DELETE CASCADE,
      CONSTRAINT fk_pagos_cuota FOREIGN KEY (cuota_id) REFERENCES cuotas_amortizacion(id),
      CONSTRAINT fk_pagos_estado_cuenta FOREIGN KEY (estado_cuenta_id) REFERENCES estados_cuenta(id)
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS pagos;');
}
