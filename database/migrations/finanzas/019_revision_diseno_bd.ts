import { Pool } from 'mysql2/promise';
import {
  addCheckIfMissing,
  addColumnIfMissing,
  addFkIfMissing,
  addIndexIfMissing,
  asegurarTipoColumna,
  columnaExiste,
  dropChecksOnColumn,
  dropForeignKeysOnColumn,
} from './helpers';

/**
 * Aplica las observaciones del documento "Revisión del diseño de BD —
 * finanzas":
 *
 *  1. usuarios: tabla nueva, ligada a COM_CODIGO + USU_CODIGO de Amelia.
 *     Todas las columnas usuario_id pasan a ser FK a usuarios(id).
 *  2. categorias: tabla propia (antes eran filas de catalogos con
 *     tipo='categoria'). Se copian con el mismo id, así que los
 *     categoria_id existentes siguen siendo válidos.
 *  3. Nombres claros en vez de "catalogo_id":
 *       tarjetas_credito.catalogo_id → entidad_id   (banco emisor)
 *       deudas.catalogo_id           → acreedor_id  (banco o empresa)
 *  4. consumos_tarjeta: modalidad → tipo_consumo ('corriente'/'diferido',
 *     sin valor por defecto) + con_intereses + meses_gracia;
 *     categoria_id NOT NULL.
 *  5. estados_cuenta: pertenece a la tarjeta (tarjeta_credito_id), no a
 *     una deuda.
 *  6. pagos.usuario_id.
 *  7. eventos_calendario.referencia_tipo (a qué apunta referencia_id).
 *  8. perfiles: nombres/apellidos/cedula VARCHAR(256).
 *  9. Montos DECIMAL(30,2).
 * 10. Sin ON DELETE CASCADE en ninguna FK.
 * 11. actualizado_en (fecha de modificación) en todas las tablas;
 *     cuotas_amortizacion también recibe creado_en.
 *
 * Idempotente: se puede correr varias veces.
 */

const TABLAS_CON_USUARIO = [
  'cuentas',
  'tarjetas_credito',
  'deudas',
  'consumos',
  'ingresos',
  'perfiles',
  'eventos_calendario',
  'notificaciones_internas',
  'pagos',
];

async function tablaExiste(pool: Pool, tabla: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabla],
  );
  return (rows as { total: number }[])[0].total > 0;
}

async function esNullable(pool: Pool, tabla: string, columna: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna],
  );
  return (rows as { n: string }[])[0]?.n === 'YES';
}

async function renombrarColumna(pool: Pool, tabla: string, de: string, a: string): Promise<void> {
  if (!(await columnaExiste(pool, tabla, de)) || (await columnaExiste(pool, tabla, a))) return;
  await pool.query(`ALTER TABLE \`${tabla}\` RENAME COLUMN \`${de}\` TO \`${a}\``);
}

async function renombrarIndice(pool: Pool, tabla: string, de: string, a: string): Promise<void> {
  const [rows] = await pool.query(
    `SELECT INDEX_NAME AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME IN (?, ?)`,
    [tabla, de, a],
  );
  const nombres = new Set((rows as { n: string }[]).map((r) => r.n));
  if (nombres.has(de) && !nombres.has(a)) {
    await pool.query(`ALTER TABLE \`${tabla}\` RENAME INDEX \`${de}\` TO \`${a}\``);
  }
}

/* ---------------------------------------------------------------- 1 */
async function crearUsuarios(pool: Pool): Promise<void> {
  // com_codigo es NULL solo para usuarios heredados (datos creados antes
  // de esta tabla, cuando usuario_id era directamente el USU_CODIGO). Se
  // completa la primera vez que ese usuario inicia sesión (ver
  // usuario.model.ts → resolverUsuario).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      com_codigo INT NULL,
      usu_codigo INT NOT NULL,
      alias VARCHAR(256) NULL,
      ruc VARCHAR(13) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_usuarios_empresa_usuario (com_codigo, usu_codigo),
      INDEX idx_usuarios_usu_codigo (usu_codigo)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

/** Registra como usuario heredado (id = usu_codigo) a todo usuario_id existente. */
async function registrarUsuariosHeredados(pool: Pool): Promise<void> {
  for (const tabla of TABLAS_CON_USUARIO) {
    if (!(await columnaExiste(pool, tabla, 'usuario_id'))) continue;
    await pool.query(
      `INSERT IGNORE INTO usuarios (id, com_codigo, usu_codigo)
       SELECT DISTINCT t.usuario_id, NULL, t.usuario_id FROM \`${tabla}\` t
       WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = t.usuario_id)`,
    );
  }
}

async function enlazarUsuarios(pool: Pool): Promise<void> {
  await registrarUsuariosHeredados(pool);
  for (const tabla of TABLAS_CON_USUARIO) {
    await addFkIfMissing(pool, tabla, `fk_${tabla}_usuario`, 'FOREIGN KEY (usuario_id) REFERENCES usuarios(id)');
  }
}

/* ---------------------------------------------------------------- 2 */
async function crearCategorias(pool: Pool): Promise<number> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      grupo VARCHAR(60) NULL,
      subtipo VARCHAR(30) NULL,
      emoji VARCHAR(10) NULL,
      color VARCHAR(20) NULL,
      notas VARCHAR(255) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_categorias_nombre (nombre)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Copia con el mismo id: los categoria_id ya guardados no cambian.
  await pool.query(`
    INSERT INTO categorias (id, nombre, grupo, subtipo, emoji, color, notas, activo, creado_en)
    SELECT c.id, c.nombre, c.grupo, c.subtipo, c.emoji, c.color, c.notas, c.activo, c.creado_en
    FROM catalogos c
    WHERE c.tipo = 'categoria'
      AND NOT EXISTS (SELECT 1 FROM categorias x WHERE x.id = c.id OR x.nombre = c.nombre)
  `);

  // "Otros": destino de los consumos que no tienen categoría válida.
  await pool.query(`
    INSERT INTO categorias (nombre, grupo, subtipo, emoji)
    SELECT 'Otros', 'Sin clasificar', 'sinClasificar', '📦' FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Otros')
  `);
  const [rows] = await pool.query("SELECT id FROM categorias WHERE nombre = 'Otros'");
  const idOtros = Number((rows as { id: number }[])[0].id);

  // Valores que no existen en categorias: NULL donde se permite, "Otros" donde no.
  await pool.query('UPDATE deudas SET categoria_id = NULL WHERE categoria_id IS NOT NULL AND categoria_id NOT IN (SELECT id FROM categorias)');
  await pool.query('UPDATE consumos SET categoria_id = ? WHERE categoria_id NOT IN (SELECT id FROM categorias)', [idOtros]);
  await pool.query(
    'UPDATE consumos_tarjeta SET categoria_id = ? WHERE categoria_id IS NULL OR categoria_id NOT IN (SELECT id FROM categorias)',
    [idOtros],
  );

  for (const tabla of ['deudas', 'consumos', 'consumos_tarjeta']) {
    await dropForeignKeysOnColumn(pool, tabla, 'categoria_id', 'categorias');
    await addFkIfMissing(pool, tabla, `fk_${tabla}_categorias`, 'FOREIGN KEY (categoria_id) REFERENCES categorias(id)');
  }

  // Las categorías ya viven en su tabla: se quitan de catalogos (solo las
  // que nada referencia como entidad/empresa; las demás quedan inactivas).
  await pool.query(`
    DELETE FROM catalogos
    WHERE tipo = 'categoria'
      AND id NOT IN (SELECT acreedor_id FROM deudas WHERE acreedor_id IS NOT NULL)
      AND id NOT IN (SELECT entidad_id FROM tarjetas_credito)
      AND id NOT IN (SELECT entidad_id FROM cuentas WHERE entidad_id IS NOT NULL)
  `);
  await pool.query("UPDATE catalogos SET activo = 0 WHERE tipo = 'categoria'");

  return idOtros;
}

/* ---------------------------------------------------------------- 3 */
async function renombrarCatalogoId(pool: Pool): Promise<void> {
  await renombrarColumna(pool, 'tarjetas_credito', 'catalogo_id', 'entidad_id');
  await renombrarIndice(pool, 'tarjetas_credito', 'idx_tarjetas_catalogo_id', 'idx_tarjetas_entidad_id');

  await renombrarColumna(pool, 'deudas', 'catalogo_id', 'acreedor_id');
  await renombrarIndice(pool, 'deudas', 'idx_deudas_catalogo_id', 'idx_deudas_acreedor_id');
}

/* ---------------------------------------------------------------- 4 */
async function ajustarConsumosTarjeta(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'consumos_tarjeta', 'tipo_consumo', 'VARCHAR(10) NULL AFTER monto');
  await addColumnIfMissing(pool, 'consumos_tarjeta', 'con_intereses', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo_consumo');
  await addColumnIfMissing(pool, 'consumos_tarjeta', 'meses_gracia', 'SMALLINT NOT NULL DEFAULT 0 AFTER plazo_meses');

  if (await columnaExiste(pool, 'consumos_tarjeta', 'modalidad')) {
    await pool.query(`
      UPDATE consumos_tarjeta SET
        tipo_consumo = IF(modalidad = 'corriente', 'corriente', 'diferido'),
        con_intereses = IF(modalidad = 'diferido_con_intereses', 1, 0)
      WHERE tipo_consumo IS NULL
    `);
    await dropChecksOnColumn(pool, 'consumos_tarjeta', 'modalidad');
    await pool.query('ALTER TABLE consumos_tarjeta DROP COLUMN modalidad');
  }

  // Sin valor por defecto: quien inserta debe decir si es corriente o diferido.
  if (await esNullable(pool, 'consumos_tarjeta', 'tipo_consumo')) {
    await pool.query('ALTER TABLE consumos_tarjeta MODIFY COLUMN tipo_consumo VARCHAR(10) NOT NULL');
  }
  await addCheckIfMissing(pool, 'consumos_tarjeta', 'chk_consumos_tarjeta_tipo_consumo', "tipo_consumo IN ('corriente', 'diferido')");

  if (await esNullable(pool, 'consumos_tarjeta', 'categoria_id')) {
    await pool.query('ALTER TABLE consumos_tarjeta MODIFY COLUMN categoria_id INT NOT NULL');
  }
}

/* ---------------------------------------------------------------- 5 */
async function estadosCuentaPorTarjeta(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'estados_cuenta', 'tarjeta_credito_id', 'INT NULL AFTER id');

  if (await columnaExiste(pool, 'estados_cuenta', 'deuda_id')) {
    await pool.query(`
      UPDATE estados_cuenta ec JOIN deudas d ON d.id = ec.deuda_id
      SET ec.tarjeta_credito_id = d.tarjeta_credito_id
      WHERE ec.tarjeta_credito_id IS NULL
    `);
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM estados_cuenta WHERE tarjeta_credito_id IS NULL');
    const sinTarjeta = Number((rows as { total: number }[])[0].total);
    if (sinTarjeta > 0) {
      throw new Error(
        `estados_cuenta: ${sinTarjeta} registro(s) pertenecen a deudas que no son de tarjeta. ` +
          'Revísalos a mano antes de correr esta migración (no se borran automáticamente).',
      );
    }
    await dropForeignKeysOnColumn(pool, 'estados_cuenta', 'deuda_id');
    await pool.query('ALTER TABLE estados_cuenta DROP COLUMN deuda_id');
  }

  if (await esNullable(pool, 'estados_cuenta', 'tarjeta_credito_id')) {
    await pool.query('ALTER TABLE estados_cuenta MODIFY COLUMN tarjeta_credito_id INT NOT NULL');
  }
  await addIndexIfMissing(pool, 'estados_cuenta', 'idx_estados_cuenta_tarjeta_id', 'tarjeta_credito_id');
  await addFkIfMissing(pool, 'estados_cuenta', 'fk_estados_cuenta_tarjeta',
    'FOREIGN KEY (tarjeta_credito_id) REFERENCES tarjetas_credito(id)');
}

/* ---------------------------------------------------------------- 6 */
async function pagosConUsuario(pool: Pool): Promise<void> {
  await addColumnIfMissing(pool, 'pagos', 'usuario_id', 'INT NULL AFTER id');
  await pool.query(`
    UPDATE pagos p JOIN deudas d ON d.id = p.deuda_id
    SET p.usuario_id = d.usuario_id
    WHERE p.usuario_id IS NULL
  `);
  if (await esNullable(pool, 'pagos', 'usuario_id')) {
    await pool.query('ALTER TABLE pagos MODIFY COLUMN usuario_id INT NOT NULL');
  }
  await addIndexIfMissing(pool, 'pagos', 'idx_pagos_usuario_id', 'usuario_id');
}

/* ---------------------------------------------------------------- 9 */
const MONTOS: [string, string, string][] = [
  ['consumos', 'monto', 'NOT NULL'],
  ['consumos_tarjeta', 'monto', 'NOT NULL'],
  ['cuotas_amortizacion', 'capital', 'NOT NULL'],
  ['cuotas_amortizacion', 'interes', 'NOT NULL'],
  ['cuotas_amortizacion', 'seguro', 'NOT NULL DEFAULT 0'],
  ['cuotas_amortizacion', 'total_cuota', 'NOT NULL'],
  ['cuotas_amortizacion', 'saldo_despues', 'NOT NULL'],
  ['deudas', 'monto_total', 'NOT NULL'],
  ['deudas', 'saldo_pendiente', 'NOT NULL'],
  ['deudas', 'resumen_minimo', 'NULL'],
  ['estados_cuenta', 'monto_calculado', 'NOT NULL DEFAULT 0'],
  ['estados_cuenta', 'monto_estado', 'NULL'],
  ['estados_cuenta', 'pago_minimo', 'NULL'],
  ['ingresos', 'monto', 'NOT NULL'],
  ['pagos', 'monto', 'NOT NULL'],
  ['pagos', 'parte_capital', 'NOT NULL DEFAULT 0'],
  ['pagos', 'parte_interes', 'NOT NULL DEFAULT 0'],
  ['pagos', 'parte_recargos', 'NOT NULL DEFAULT 0'],
  ['perfiles', 'ingreso_mensual_estimado', 'NULL'],
  ['tablas_amortizacion', 'monto_financiado', 'NOT NULL'],
  ['tablas_amortizacion', 'seg_desgravamen_valor', 'NOT NULL DEFAULT 0'],
  ['tablas_amortizacion', 'otros_seguros', 'NOT NULL DEFAULT 0'],
  ['tarjetas_credito', 'cupo', 'NOT NULL'],
  ['tarjetas_credito', 'costo_anual', 'NULL'],
];

async function ampliarMontos(pool: Pool): Promise<void> {
  for (const [tabla, columna, resto] of MONTOS) {
    await asegurarTipoColumna(pool, tabla, columna, 'decimal(30,2)', `DECIMAL(30, 2) ${resto}`);
  }
}

/* ---------------------------------------------------------------- 10 */
/** Toda FK con ON DELETE CASCADE se recrea con RESTRICT (mismo nombre y columnas). */
async function quitarCascadas(pool: Pool): Promise<void> {
  const [rows] = await pool.query(`
    SELECT rc.TABLE_NAME AS tabla, rc.CONSTRAINT_NAME AS nombre, rc.REFERENCED_TABLE_NAME AS destino,
           GROUP_CONCAT(CONCAT('\`', k.COLUMN_NAME, '\`') ORDER BY k.ORDINAL_POSITION) AS columnas,
           GROUP_CONCAT(CONCAT('\`', k.REFERENCED_COLUMN_NAME, '\`') ORDER BY k.ORDINAL_POSITION) AS columnas_destino
    FROM information_schema.REFERENTIAL_CONSTRAINTS rc
    JOIN information_schema.KEY_COLUMN_USAGE k
      ON k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND k.TABLE_NAME = rc.TABLE_NAME
    WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND rc.DELETE_RULE = 'CASCADE'
    GROUP BY rc.TABLE_NAME, rc.CONSTRAINT_NAME, rc.REFERENCED_TABLE_NAME
  `);
  for (const fk of rows as { tabla: string; nombre: string; destino: string; columnas: string; columnas_destino: string }[]) {
    await pool.query(`ALTER TABLE \`${fk.tabla}\` DROP FOREIGN KEY \`${fk.nombre}\``);
    await pool.query(
      `ALTER TABLE \`${fk.tabla}\` ADD CONSTRAINT \`${fk.nombre}\` FOREIGN KEY (${fk.columnas})
         REFERENCES \`${fk.destino}\` (${fk.columnas_destino}) ON DELETE RESTRICT`,
    );
  }
}

/* ---------------------------------------------------------------- 11 */
const TABLAS_AUDITADAS = [
  'catalogos',
  'cuentas',
  'tarjetas_credito',
  'deudas',
  'tablas_amortizacion',
  'cuotas_amortizacion',
  'estados_cuenta',
  'pagos',
  'consumos',
  'consumos_tarjeta',
  'ingresos',
  'perfiles',
  'eventos_calendario',
  'notificaciones_internas',
  'marcas_tarjeta',
  'categorias_tarjeta',
];

async function agregarFechasAuditoria(pool: Pool): Promise<void> {
  if (!(await columnaExiste(pool, 'cuotas_amortizacion', 'creado_en'))) {
    await addColumnIfMissing(pool, 'cuotas_amortizacion', 'creado_en', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    // La cuota se creó junto con su tabla de amortización.
    await pool.query(`
      UPDATE cuotas_amortizacion c JOIN tablas_amortizacion t ON t.id = c.tabla_amortizacion_id
      SET c.creado_en = t.creado_en
    `);
  }

  for (const tabla of TABLAS_AUDITADAS) {
    if (!(await tablaExiste(pool, tabla)) || (await columnaExiste(pool, tabla, 'actualizado_en'))) continue;
    await addColumnIfMissing(
      pool,
      tabla,
      'actualizado_en',
      'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    );
    // Los registros existentes no se han modificado desde que se crearon.
    await pool.query(`UPDATE \`${tabla}\` SET actualizado_en = creado_en`);
  }
}

export async function up(pool: Pool): Promise<void> {
  await crearUsuarios(pool);
  await renombrarCatalogoId(pool);
  await crearCategorias(pool);
  await ajustarConsumosTarjeta(pool);
  await estadosCuentaPorTarjeta(pool);
  await pagosConUsuario(pool);

  // 7. A qué tabla apunta referencia_id (igual que en notificaciones_internas).
  await addColumnIfMissing(pool, 'eventos_calendario', 'referencia_tipo', 'VARCHAR(20) NULL AFTER tipo');

  // 8. Perfiles.
  await asegurarTipoColumna(pool, 'perfiles', 'nombres', 'varchar(256)', 'VARCHAR(256) NOT NULL');
  await asegurarTipoColumna(pool, 'perfiles', 'apellidos', 'varchar(256)', 'VARCHAR(256) NOT NULL');
  await asegurarTipoColumna(pool, 'perfiles', 'cedula', 'varchar(256)', 'VARCHAR(256) NOT NULL');

  await ampliarMontos(pool);
  await quitarCascadas(pool);
  await enlazarUsuarios(pool);
  await agregarFechasAuditoria(pool);
}

/**
 * Solo revierte lo que no pierde datos. Renombres, el paso de categorías
 * a su tabla y el cambio de estados_cuenta a tarjeta no se deshacen
 * automáticamente.
 */
export async function down(pool: Pool): Promise<void> {
  for (const tabla of TABLAS_CON_USUARIO) {
    await dropForeignKeysOnColumn(pool, tabla, 'usuario_id');
  }
  for (const tabla of TABLAS_AUDITADAS) {
    if (await columnaExiste(pool, tabla, 'actualizado_en')) {
      await pool.query(`ALTER TABLE \`${tabla}\` DROP COLUMN actualizado_en`);
    }
  }
  if (await columnaExiste(pool, 'eventos_calendario', 'referencia_tipo')) {
    await pool.query('ALTER TABLE eventos_calendario DROP COLUMN referencia_tipo');
  }
}
