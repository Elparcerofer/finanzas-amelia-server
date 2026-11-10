import { Pool } from 'mysql2/promise';
import {
  addCheckIfMissing,
  addColumnIfMissing,
  addFkIfMissing,
  addIndexIfMissing,
  columnaExiste,
  dropChecksOnColumn,
} from './helpers';

/**
 * Pantallas "Registrar pago" y "Detalle de pago" del prototipo Solvenza.
 *
 * El estado de una deuda (cuotas pagadas, saldo, si está liquidada…) ya
 * no se guarda mutando la deuda: se DERIVA reproduciendo sus pagos en
 * orden (ver services/finanzas/motor). Así "anular el último pago" es
 * simplemente marcarlo como anulado, sin fotos del estado anterior.
 *
 * pagos:
 *   accion        cuota | parcial | capital | liq_capital | liq_total
 *   clave         obligación que se pagó: c:<n> cuota de la tabla,
 *                 p:<YYYY-MM> período de tarjeta, r / r+<k> resumida.
 *   fecha_vence   vencimiento de esa obligación (para puntualidad).
 *   modo_abono    plazo | cuota (solo abono extraordinario a capital).
 *   metodo_pago   medio (transferencia, banca_movil, …).
 *   parte_*       desglose capital / interés / seguro / recargos.
 *   saldo_* / total_*  cómo quedó la deuda antes y después.
 *   origen_*      de dónde salió el dinero (cuenta, tarjeta, tercero…).
 *
 * pagos_categorias  reparto del pago en categorías (opcional).
 * pagos_cargos      multas, cobranza, comisiones… pagadas de más.
 *
 * Idempotente.
 */

const METODOS = [
  'transferencia',
  'banca_movil',
  'debito_automatico',
  'tarjeta_debito',
  'tarjeta_credito',
  'efectivo',
  'tercero',
  'otro',
];

export async function up(pool: Pool): Promise<void> {
  const col = (c: string, def: string) => addColumnIfMissing(pool, 'pagos', c, def);

  await col('accion', "VARCHAR(15) NOT NULL DEFAULT 'cuota' AFTER deuda_id");
  await col('clave', 'VARCHAR(30) NULL AFTER accion');
  await col('fecha_vence', 'DATE NULL AFTER fecha_pago');
  await col('modo_abono', 'VARCHAR(10) NULL AFTER clave');
  await col('descripcion', 'VARCHAR(255) NULL AFTER modo_abono');
  await col('parte_seguro', 'DECIMAL(30, 2) NOT NULL DEFAULT 0 AFTER parte_interes');
  await col('saldo_antes', 'DECIMAL(30, 2) NULL');
  await col('saldo_despues', 'DECIMAL(30, 2) NULL');
  await col('total_antes', 'DECIMAL(30, 2) NULL');
  await col('total_despues', 'DECIMAL(30, 2) NULL');
  await col('origen_cuenta_id', 'INT NULL');
  await col('origen_tarjeta_id', 'INT NULL');
  await col('origen_agencia', 'VARCHAR(120) NULL');
  await col('origen_tercero', 'VARCHAR(150) NULL');
  await col('origen_relacion', 'VARCHAR(30) NULL');

  // Medios del prototipo (antes solo efectivo/transferencia/tarjeta/débito).
  await pool.query(`UPDATE pagos SET metodo_pago = 'tarjeta_credito' WHERE metodo_pago = 'tarjeta'`);
  await dropChecksOnColumn(pool, 'pagos', 'metodo_pago');
  await addCheckIfMissing(pool, 'pagos', 'chk_pagos_metodo', `metodo_pago IN (${METODOS.map((m) => `'${m}'`).join(', ')})`);
  await addCheckIfMissing(
    pool,
    'pagos',
    'chk_pagos_accion',
    "accion IN ('cuota', 'parcial', 'capital', 'liq_capital', 'liq_total')",
  );
  await addCheckIfMissing(pool, 'pagos', 'chk_pagos_estado', "estado IN ('registrado', 'anulado')");

  // deudas.resumen_saldo: el saldo que el usuario INFORMÓ al registrar
  // una deuda resumida (null = no lo informó). saldo_pendiente pasa a ser
  // el saldo real, recalculado con cada pago; antes guardaba ese dato
  // informado (o el valor de la cuota si no se informó), así que solo se
  // copia cuando difiere del valor registrado.
  if (!(await columnaExiste(pool, 'deudas', 'resumen_saldo'))) {
    await addColumnIfMissing(pool, 'deudas', 'resumen_saldo', 'DECIMAL(30, 2) NULL AFTER resumen_corte');
    await pool.query(`
      UPDATE deudas d SET d.resumen_saldo = d.saldo_pendiente
      WHERE d.saldo_pendiente <> d.monto_total
        AND d.tipo_deuda NOT IN ('tarjeta', 'suscripcion')
        AND NOT EXISTS (SELECT 1 FROM tablas_amortizacion t WHERE t.deuda_id = d.id)
        AND NOT EXISTS (SELECT 1 FROM consumos_tarjeta c WHERE c.deuda_id = d.id)
    `);
  }

  // deudas.estado es un resumen que se recalcula con cada pago; se suma
  // 'liquidada' (precancelada) además de 'pagada' (terminó sus cuotas).
  await dropChecksOnColumn(pool, 'deudas', 'estado');
  await addCheckIfMissing(
    pool,
    'deudas',
    'chk_deudas_estado',
    "estado IN ('pendiente', 'al_dia', 'vencida', 'pagada', 'liquidada')",
  );

  await addIndexIfMissing(pool, 'pagos', 'idx_pagos_usuario_fecha', 'usuario_id, fecha_pago');
  await addFkIfMissing(pool, 'pagos', 'fk_pagos_origen_cuenta', 'FOREIGN KEY (origen_cuenta_id) REFERENCES cuentas(id)');
  await addFkIfMissing(pool, 'pagos', 'fk_pagos_origen_tarjeta', 'FOREIGN KEY (origen_tarjeta_id) REFERENCES tarjetas_credito(id)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos_categorias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pago_id INT NOT NULL,
      categoria_id INT NOT NULL,
      monto DECIMAL(30, 2) NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pagos_categorias (pago_id, categoria_id),
      INDEX idx_pagos_categorias_categoria (categoria_id),
      CONSTRAINT fk_pagos_categorias_pago FOREIGN KEY (pago_id) REFERENCES pagos(id),
      CONSTRAINT fk_pagos_categorias_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos_cargos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pago_id INT NOT NULL,
      tipo VARCHAR(15) NOT NULL,
      monto DECIMAL(30, 2) NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pagos_cargos (pago_id, tipo),
      CONSTRAINT fk_pagos_cargos_pago FOREIGN KEY (pago_id) REFERENCES pagos(id),
      CONSTRAINT chk_pagos_cargos_tipo CHECK (tipo IN ('cobranza', 'multa', 'comision', 'otros'))
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS pagos_cargos');
  await pool.query('DROP TABLE IF EXISTS pagos_categorias');
}
