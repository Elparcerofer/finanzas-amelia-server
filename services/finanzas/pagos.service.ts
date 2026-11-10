/**
 * Registrar pago (lista de pendientes + historial) y Detalle de pago
 * (pago de cuota, abono, abono a capital, liquidación y anulación).
 * Prototipo Solvenza: renderPagos, renderPago, doPay, anularPago.
 */
import { HttpError } from '../../middlewares/error.middleware';
import {
  cuentaEsDelUsuario,
  deudaDelPago,
  insertarPago,
  marcarPagoAnulado,
  tarjetaEsDelUsuario,
  ultimoPagoVigente,
} from '../../models/finanzas/cartera.model';
import { categoriasExistentes } from '../../models/finanzas/deuda.model';
import {
  cargarCartera,
  cargarNombres,
  deudaRef,
  estadoParaDb,
  MEDIOS,
  movimientoApi,
  Nombres,
  obligacionApi,
  resumenCostos,
} from './cartera.service';
import { aplicarPago, buscarObligacion, PagoInvalido } from './motor/aplicar';
import { diasHasta, hoyISO, r2, suma } from './motor/fechas';
import {
  cuotasPagadasSeguidas,
  esPrestamoDetallado,
  esTarjetaDetallada,
  infoDeuda,
  pendientes,
  simularAbono,
  tasaDe,
} from './motor/obligaciones';
import { Accion, DeudaMotor, ETIQUETA_CARGO, Movimiento, TipoCargo } from './motor/tipos';

/* ------------------------------------------------------------- lectura */

/** Pendientes de todas las deudas, en orden de vencimiento, con los totales del encabezado. */
export async function listarPendientes(usuarioId: number) {
  const hoy = hoyISO();
  const [deudas, n] = await Promise.all([cargarCartera(usuarioId), cargarNombres(usuarioId)]);
  const P = deudas
    .flatMap((d) => pendientes(d, hoy).map((it) => obligacionApi(d, it, hoy, n)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const mes = hoy.slice(0, 7);
  const grupo = (f: (x: (typeof P)[number]) => boolean) => {
    const xs = P.filter(f);
    return { monto: r2(suma(xs, (x) => x.monto)), cantidad: xs.length };
  };
  return {
    hoy,
    totales: {
      vencido: grupo((x) => x.diasHasta < 0),
      proximos7: grupo((x) => x.diasHasta >= 0 && x.diasHasta <= 7),
      restoMes: grupo((x) => x.diasHasta >= 0 && x.fecha.slice(0, 7) === mes),
      proximos30: grupo((x) => x.diasHasta >= 0 && x.diasHasta <= 30),
    },
    pendientes: P,
  };
}

/** Todos los pagos registrados (más recientes primero) con el resumen de costos. */
export async function listarHistorial(usuarioId: number) {
  const [deudas, n] = await Promise.all([cargarCartera(usuarioId), cargarNombres(usuarioId)]);
  const ms = deudas.flatMap((d) => d.movs.map((m) => ({ d, m })));
  ms.sort((a, b) => b.m.fecha.localeCompare(a.m.fecha) || b.m.id - a.m.id);
  return {
    resumen: resumenCostos(ms.map((x) => x.m)),
    movimientos: ms.map(({ d, m }) => movimientoApi(d, m, n)),
  };
}

async function deudaOError(usuarioId: number, deudaId: number, sinPagoId?: number): Promise<DeudaMotor> {
  const [d] = await cargarCartera(usuarioId, deudaId, sinPagoId);
  if (!d) throw new HttpError(404, 'Deuda no encontrada');
  return d;
}

/** Medio y origen sugeridos: los de "¿Con qué se paga?" o los del último pago (prototipo: initPayUI). */
function medioSugerido(d: DeudaMotor): { medio: string; origen: Movimiento['origen'] } {
  if (d.pagaCon) {
    const [k, v] = d.pagaCon.split(':');
    if (k === 't') return { medio: 'tarjeta_credito', origen: { tarjetaId: Number(v) } };
    if (k === 'c') return { medio: 'debito_automatico', origen: { cuentaId: Number(v) } };
    return { medio: 'debito_automatico', origen: null };
  }
  const ultimo = [...d.movs].reverse().find((m) => m.medio);
  if (ultimo) return { medio: ultimo.medio, origen: ultimo.origen };
  return { medio: 'transferencia', origen: null };
}

function detalle(d: DeudaMotor, n: Nombres, hoy: string) {
  const inf = infoDeuda(d, hoy);
  const ms = d.movs;
  return {
    hoy,
    deuda: {
      ...deudaRef(d, n),
      categoriaId: d.categoriaId,
      tasa: tasaDe(d) || null,
      /** Con tabla de amortización: habilita el abono extraordinario a capital. */
      conTabla: esPrestamoDetallado(d),
      tarjetaDetallada: esTarjetaDetallada(d),
      liquidacion: d.liq,
    },
    pendientes: pendientes(d, hoy).map((it) => obligacionApi(d, it, hoy, n)),
    info: inf,
    /** Liquidar por capital solo se ofrece si cuesta menos que pagar todo. */
    liquidarPorCapital: inf.liqCapital < inf.totalPorPagar - 0.009,
    pagadoHastaHoy: r2(suma(ms, (m) => m.monto)),
    costoPagado: r2(suma(ms, (m) => m.partes.interes + m.partes.seguro + (m.partes.cargos || 0))),
    resumen: resumenCostos(ms),
    movimientos: [...ms]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
      .map((m) => movimientoApi(d, m, n)),
    sugerido: medioSugerido(d),
  };
}

export async function obtenerDetalle(usuarioId: number, deudaId: number) {
  const hoy = hoyISO();
  const [d, n] = await Promise.all([deudaOError(usuarioId, deudaId), cargarNombres(usuarioId)]);
  return detalle(d, n, hoy);
}

/** Cómo queda la deuda con un abono extraordinario a capital (prototipo: simAbono). */
export async function simularAbonoCapital(usuarioId: number, deudaId: number, monto: number, modo: 'plazo' | 'cuota') {
  const hoy = hoyISO();
  const d = await deudaOError(usuarioId, deudaId);
  if (!esPrestamoDetallado(d)) {
    throw new HttpError(422, 'Solo los créditos con tabla de amortización admiten abono a capital');
  }
  const inf = infoDeuda(d, hoy);
  if (monto >= inf.saldoCapital - 0.01) {
    return { cubreTodo: true, saldoAntes: inf.saldoCapital, saldoDespues: 0, ahorro: 0, mesesMenos: 0, nuevaCuota: 0, cuotaActual: 0 };
  }
  const s = simularAbono(d.amort!.rows, tasaDe(d), cuotasPagadasSeguidas(d), monto, modo);
  return { cubreTodo: false, saldoAntes: inf.saldoCapital, saldoDespues: r2(inf.saldoCapital - monto), ...s };
}

/* ----------------------------------------------------------- registro */

export interface RegistrarPagoInput {
  deudaId: number;
  clave: string | null;
  accion: Accion;
  /** Lo realmente pagado (incluye multas y cargos). */
  montoPagado: number;
  fecha: string | Date;
  medio: string;
  comprobante?: string | null;
  modoAbono?: 'plazo' | 'cuota' | null;
  origen?: {
    cuentaId?: number | null;
    tarjetaId?: number | null;
    agencia?: string | null;
    tercero?: string | null;
    relacion?: string | null;
  } | null;
  categorias?: { categoriaId: number; monto: number }[] | null;
  cargos?: { tipo: TipoCargo; monto: number }[] | null;
}

const fmt = (x: number): string =>
  '$' + Math.abs(x).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Las multas/cargos deben explicar exactamente lo pagado de más (prototipo: cargosFinal). */
function validarCargos(diferencia: number, cargos: RegistrarPagoInput['cargos']): [string, number][] {
  if (diferencia <= 0.009) return [];
  const lista = (cargos || []).filter((c) => c.monto > 0);
  if (!lista.length) throw new HttpError(422, 'Elige la razón de la diferencia: cobranza, multa, comisión u otros cargos');
  if (Math.abs(suma(lista, (c) => c.monto) - diferencia) > 0.01) {
    throw new HttpError(422, `Los valores deben sumar ${fmt(diferencia)}`);
  }
  return lista.map((c) => [c.tipo, r2(c.monto)]);
}

/** Reparto del pago en categorías (prototipo: catsFinal). Con una sola, se le asigna todo. */
async function validarCategorias(
  base: number,
  cats: RegistrarPagoInput['categorias'],
  d: DeudaMotor,
): Promise<[number, number][]> {
  const lista = (cats || []).filter((c) => c.categoriaId);
  // Tarjeta detallada: la categoría sale de cada consumo.
  if (!lista.length || esTarjetaDetallada(d)) return [];
  const existentes = await categoriasExistentes(lista.map((c) => c.categoriaId));
  if (lista.some((c) => !existentes.has(c.categoriaId))) throw new HttpError(400, 'Una de las categorías no existe');
  if (lista.length === 1) return [[lista[0].categoriaId, r2(base)]];
  if (lista.some((c) => c.monto < 0) || Math.abs(suma(lista, (c) => c.monto) - base) > 0.01) {
    throw new HttpError(422, `Las categorías deben sumar ${fmt(base)}`);
  }
  return lista.map((c) => [c.categoriaId, r2(c.monto)]);
}

async function validarOrigen(usuarioId: number, o: RegistrarPagoInput['origen']) {
  const cuentaId = o?.cuentaId || null;
  const tarjetaId = o?.tarjetaId || null;
  if (cuentaId && !(await cuentaEsDelUsuario(usuarioId, cuentaId))) throw new HttpError(400, 'La cuenta de origen no existe');
  if (tarjetaId && !(await tarjetaEsDelUsuario(usuarioId, tarjetaId))) {
    throw new HttpError(400, 'La tarjeta de origen no existe');
  }
  return {
    cuentaId,
    tarjetaId,
    agencia: o?.agencia?.trim() || null,
    tercero: o?.tercero?.trim() || null,
    relacion: o?.relacion?.trim() || null,
  };
}

const aFecha = (v: string | Date): string => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10));

export async function registrarPago(usuarioId: number, input: RegistrarPagoInput) {
  const hoy = hoyISO();
  const fecha = aFecha(input.fecha);
  if (fecha > hoy) throw new HttpError(422, 'La fecha de pago no puede ser futura');
  if (!MEDIOS.some((m) => m[0] === input.medio)) throw new HttpError(400, 'Medio de pago no válido');

  const d = await deudaOError(usuarioId, input.deudaId);
  const antes = infoDeuda(d, hoy);
  const pagado = r2(input.montoPagado);
  const accion = input.accion;
  const pend = pendientes(d, hoy);

  // base = lo que se aplica a la deuda; lo pagado por encima son cargos.
  let base: number;
  let clave: string | null = input.clave;
  if (accion === 'cuota' || accion === 'parcial') {
    const it = buscarObligacion(d, clave, hoy);
    if (!it || !pend.some((x) => x.clave === it.clave)) throw new HttpError(409, 'Esa cuota ya no está pendiente');
    if (accion === 'cuota') {
      if (pagado < it.monto - 0.009) throw new HttpError(422, 'Es menor a la cuota: regístralo como Abono');
      base = it.monto;
    } else {
      if (!(pagado > 0)) throw new HttpError(422, 'Ingresa el monto del abono');
      if (pagado >= it.monto - 0.009) throw new HttpError(422, 'Para pagar todo usa “Pago total de la cuota”');
      base = pagado;
    }
  } else if (accion === 'capital') {
    if (!esPrestamoDetallado(d)) {
      throw new HttpError(422, 'El abono a capital solo aplica a créditos con tabla de amortización');
    }
    if (pend.some((x) => diasHasta(x.fecha, hoy) < 0)) throw new HttpError(422, 'Primero ponte al día con las cuotas vencidas');
    if (!(pagado > 0)) throw new HttpError(422, 'Ingresa el monto del abono');
    if (pagado >= antes.saldoCapital - 0.01) throw new HttpError(422, 'El abono cubre todo el capital: usa Liquidar deuda');
    base = pagado;
    clave = null;
  } else {
    if (!(antes.totalPorPagar > 0)) throw new HttpError(409, 'La deuda no tiene saldo por liquidar');
    if (accion === 'liq_capital' && antes.liqCapital >= antes.totalPorPagar - 0.009) {
      throw new HttpError(422, 'En esta deuda liquidar por capital cuesta lo mismo: usa Pago total');
    }
    base = accion === 'liq_total' ? antes.totalPorPagar : antes.liqCapital;
    if (pagado < base - 0.009) throw new HttpError(422, 'El valor pagado es menor al de liquidación');
    clave = null;
  }

  const cargos = accion === 'parcial' || accion === 'capital' ? [] : validarCargos(r2(pagado - base), input.cargos);
  const categorias = await validarCategorias(base, input.categorias, d);
  const origen = await validarOrigen(usuarioId, input.origen);

  let res;
  try {
    res = aplicarPago(d, { accion, clave, monto: base, fecha, modoAbono: input.modoAbono || null });
  } catch (e) {
    if (e instanceof PagoInvalido) throw new HttpError(409, e.message);
    throw e;
  }
  const despues = infoDeuda(d, hoy);

  let partes = res.partes;
  if (accion === 'liq_capital' || accion === 'liq_total') {
    const cap = Math.min(antes.saldoCapital, res.monto);
    const seg = accion === 'liq_total' ? antes.segurosPorPagar : 0;
    partes = { capital: r2(cap), interes: r2(Math.max(0, res.monto - cap - seg)), seguro: r2(seg) };
  }
  const totalCargos = r2(suma(cargos, (c) => c[1]));
  const { estado, saldo } = estadoParaDb(d, hoy);

  const pagoId = await insertarPago(usuarioId, {
    deudaId: d.id,
    accion,
    clave,
    modoAbono: accion === 'capital' ? input.modoAbono || 'plazo' : null,
    descripcion: res.desc,
    monto: r2(res.monto + totalCargos),
    fechaPago: fecha,
    fechaVence: res.fechaVence,
    metodoPago: input.medio,
    comprobante: input.comprobante?.trim() || null,
    parteCapital: partes.capital,
    parteInteres: partes.interes,
    parteSeguro: partes.seguro,
    parteRecargos: totalCargos,
    saldoAntes: antes.saldoCapital,
    saldoDespues: despues.saldoCapital,
    totalAntes: antes.totalPorPagar,
    totalDespues: despues.totalPorPagar,
    origenCuentaId: origen.cuentaId,
    origenTarjetaId: origen.tarjetaId,
    origenAgencia: origen.agencia,
    origenTercero: origen.tercero,
    origenRelacion: origen.relacion,
    categorias,
    cargos,
    estadoDeuda: estado,
    saldoDeuda: saldo,
  });

  return { pagoId, detalle: await obtenerDetalle(usuarioId, d.id) };
}

/** Anula el último pago de la deuda (prototipo: anularPago). */
export async function anularPago(usuarioId: number, pagoId: number, motivo: string | null) {
  const deudaId = await deudaDelPago(usuarioId, pagoId);
  if (!deudaId) throw new HttpError(404, 'Pago no encontrado');
  if ((await ultimoPagoVigente(usuarioId, deudaId)) !== pagoId) {
    throw new HttpError(409, 'Solo puedes anular el último pago registrado de cada deuda');
  }
  // Cómo queda la deuda sin ese pago.
  const d = await deudaOError(usuarioId, deudaId, pagoId);
  const { estado, saldo } = estadoParaDb(d);
  await marcarPagoAnulado(usuarioId, pagoId, motivo, deudaId, estado, saldo);
  return obtenerDetalle(usuarioId, deudaId);
}

/**
 * Lo que necesita el formulario de pago: medios, razones de cargos y las
 * cuentas, tarjetas y categorías del usuario con su nombre ya armado.
 */
export async function opcionesPago(usuarioId: number) {
  const n = await cargarNombres(usuarioId);
  const orden = <T extends { nombre: string }>(xs: T[]) => xs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return {
    medios: MEDIOS.map(([codigo, etiqueta]) => ({ codigo, etiqueta })),
    cargos: (Object.keys(ETIQUETA_CARGO) as TipoCargo[]).map((codigo) => ({ codigo, etiqueta: ETIQUETA_CARGO[codigo] })),
    relaciones: ['Pareja', 'Familiar', 'Amigo/a', 'Empleador', 'Socio', 'Otro'],
    cuentas: orden([...n.cuentas].map(([id, c]) => ({ id, nombre: c.nombre, tercero: c.tercero, tipo: c.tipo }))),
    tarjetas: orden([...n.tarjetas].map(([id, t]) => ({ id, nombre: t.nombre, tercero: t.tercero }))),
    categorias: [...n.categorias]
      .filter(([, c]) => c.activo && !c.sistema)
      .map(([id, c]) => ({ id, nombre: c.nombre, emoji: c.emoji, color: c.color, grupo: c.grupo || 'Otros' }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'es') || a.nombre.localeCompare(b.nombre, 'es')),
  };
}
