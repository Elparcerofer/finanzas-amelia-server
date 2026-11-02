import { Pool } from 'mysql2/promise';

/**
 * Tabla nueva: no existía en la BD real (solo tarjetas_credito/deudas
 * tenían dueño). La pantalla de Cuentas de Flutter (CuentaBancaria) la
 * necesita para registrar de dónde sale/entra el dinero.
 */
export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cuentas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      alias VARCHAR(100) NOT NULL,
      tipo_cuenta VARCHAR(20) NOT NULL DEFAULT 'ahorros',
      entidad_id INT NULL,
      ultimos4 CHAR(4) NULL,
      titular VARCHAR(100) NULL,
      propiedad VARCHAR(20) NOT NULL DEFAULT 'propia',
      relacion VARCHAR(60) NULL,
      notas VARCHAR(255) NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cuentas_usuario_id (usuario_id),
      CONSTRAINT fk_cuentas_entidad FOREIGN KEY (entidad_id) REFERENCES catalogos(id)
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS cuentas;');
}
