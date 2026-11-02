import { Pool } from 'mysql2/promise';

/** Tabla ya existente en la BD real — sin cambios, se documenta para instalaciones nuevas. */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consumos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      categoria_id INT NOT NULL,
      monto DECIMAL(12, 2) NOT NULL,
      fecha DATE NOT NULL,
      descripcion VARCHAR(255) NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_consumos_usuario_id (usuario_id),
      INDEX idx_consumos_categoria_id (categoria_id),
      CONSTRAINT fk_consumos_categoria FOREIGN KEY (categoria_id) REFERENCES catalogos(id)
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS consumos;');
}
