import { Pool } from 'mysql2/promise';

/** Tabla ya existente en la BD real — sin cambios, se documenta para instalaciones nuevas. */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consumos_tarjeta (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deuda_id INT NOT NULL,
      fecha_consumo DATE NOT NULL,
      comercio VARCHAR(150) NOT NULL,
      categoria_id INT NULL,
      monto DECIMAL(12, 2) NOT NULL,
      modalidad VARCHAR(25) NOT NULL DEFAULT 'corriente',
      plazo_meses SMALLINT NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_consumos_tarjeta_deuda_id (deuda_id),
      INDEX idx_consumos_tarjeta_categoria_id (categoria_id),
      CONSTRAINT fk_consumos_tarjeta_deuda FOREIGN KEY (deuda_id) REFERENCES deudas(id) ON DELETE CASCADE,
      CONSTRAINT fk_consumos_tarjeta_categoria FOREIGN KEY (categoria_id) REFERENCES catalogos(id)
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS consumos_tarjeta;');
}
