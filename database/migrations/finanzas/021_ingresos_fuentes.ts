import { Pool } from 'mysql2/promise';
import { addCheckIfMissing, addColumnIfMissing, addFkIfMissing, addIndexIfMissing, dropChecksOnColumn } from './helpers';

/**
 * Pantalla "Registrar ingresos" del prototipo Solvenza.
 *
 *  - fuentes_ingreso: catálogo de fuentes (sueldo, décimos, ventas…) con
 *    su clase, que define cómo cuenta para la capacidad de pago:
 *      fijo      suma al ingreso fijo mensual
 *      extra     extraordinario (décimos, utilidades, bonos…)
 *      variable  honorarios, negocio, ventas…
 *      activo    venta de activos (utilidad)
 *      otro      otros ingresos
 *      prestamo  dinero prestado: NO es ingreso
 *  - ingresos.fuente pasa a ser el código de la fuente (FK). Los textos
 *    libres anteriores quedan como 'otro' y el texto en descripcion.
 *  - ingresos.hasta (YYYY-MM): hasta cuándo se repite un ingreso mensual.
 *  - ingresos.cuenta_id: cuenta donde se recibe (opcional).
 *  - periodicidad: 'mensual' (cada mes) o 'unico' (una sola vez).
 *
 * Idempotente.
 */

export const FUENTES_INGRESO: [string, string, string][] = [
  ['sueldo', 'Sueldo / salario', 'fijo'],
  ['arriendo', 'Arriendos cobrados', 'fijo'],
  ['pension', 'Jubilación o pensión', 'fijo'],
  ['alimentos', 'Pensión alimenticia recibida', 'fijo'],
  ['d13', 'Décimo tercer sueldo', 'extra'],
  ['d14', 'Décimo cuarto sueldo', 'extra'],
  ['freserva', 'Fondos de reserva', 'extra'],
  ['utilidades', 'Utilidades (participación laboral)', 'extra'],
  ['bonos', 'Bonos y comisiones', 'extra'],
  ['hextra', 'Horas extra', 'extra'],
  ['sri', 'Devolución de impuestos (SRI)', 'extra'],
  ['honorarios', 'Honorarios / facturación profesional', 'variable'],
  ['negocio', 'Ingresos de negocio propio', 'variable'],
  ['ventas', 'Ventas por catálogo o emprendimiento', 'variable'],
  ['remesas', 'Remesas del exterior', 'variable'],
  ['inversiones', 'Intereses e inversiones (pólizas)', 'variable'],
  ['ocasional', 'Trabajos ocasionales', 'variable'],
  ['vactivo', 'Venta de activo (utilidad)', 'activo'],
  ['vvehiculo', 'Venta de vehículo (utilidad)', 'activo'],
  ['vinmueble', 'Venta de inmueble (utilidad)', 'activo'],
  ['bdh', 'Bono de Desarrollo Humano', 'otro'],
  ['regalos', 'Regalos o ayuda familiar', 'otro'],
  ['otro', 'Otros ingresos', 'otro'],
  ['prestamo', 'Préstamo recibido (no es ingreso)', 'prestamo'],
];

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuentes_ingreso (
      codigo VARCHAR(20) PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      clase VARCHAR(10) NOT NULL,
      orden SMALLINT NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_fuentes_ingreso_clase CHECK (clase IN ('fijo', 'extra', 'variable', 'activo', 'otro', 'prestamo'))
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(
    `INSERT INTO fuentes_ingreso (codigo, nombre, clase, orden) VALUES ?
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), clase = VALUES(clase), orden = VALUES(orden)`,
    [FUENTES_INGRESO.map(([c, n, k], i) => [c, n, k, i + 1])],
  );

  await addColumnIfMissing(pool, 'ingresos', 'descripcion', 'VARCHAR(255) NULL AFTER fuente');
  await addColumnIfMissing(pool, 'ingresos', 'hasta', 'CHAR(7) NULL AFTER periodicidad');
  await addColumnIfMissing(pool, 'ingresos', 'cuenta_id', 'INT NULL AFTER hasta');

  // Textos libres anteriores → fuente 'otro' conservando el texto.
  await pool.query(`
    UPDATE ingresos SET descripcion = COALESCE(descripcion, fuente), fuente = 'otro'
    WHERE fuente NOT IN (SELECT codigo FROM fuentes_ingreso)
  `);
  await pool.query('ALTER TABLE ingresos MODIFY COLUMN fuente VARCHAR(20) NOT NULL');
  // quincenal/semanal nunca se usaron en la app: se tratan como mensuales.
  await pool.query("UPDATE ingresos SET periodicidad = 'mensual' WHERE periodicidad IN ('quincenal', 'semanal')");
  await dropChecksOnColumn(pool, 'ingresos', 'periodicidad');
  await addCheckIfMissing(pool, 'ingresos', 'chk_ingresos_periodicidad', "periodicidad IN ('mensual', 'unico')");

  await addIndexIfMissing(pool, 'ingresos', 'idx_ingresos_fuente', 'fuente');
  await addFkIfMissing(pool, 'ingresos', 'fk_ingresos_fuente', 'FOREIGN KEY (fuente) REFERENCES fuentes_ingreso(codigo)');
  await addFkIfMissing(pool, 'ingresos', 'fk_ingresos_cuenta', 'FOREIGN KEY (cuenta_id) REFERENCES cuentas(id)');
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('ALTER TABLE ingresos DROP FOREIGN KEY fk_ingresos_fuente');
  await pool.query('DROP TABLE IF EXISTS fuentes_ingreso');
}
