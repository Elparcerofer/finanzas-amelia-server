import {
  actualizarDeudaCompleta,
  categoriasExistentes,
  ConsumoTarjetaFila,
  CuotaAmortizacionFila,
  DatosConsumoDb,
  DatosCuotaDb,
  DatosDeudaDb,
  DatosTablaAmortizacionDb,
  DeudaFila,
  diaPagoTarjeta,
  pagaConValido,
  eliminarDeudaCompleta,
  insertarDeudaCompleta,
  listarDeudasFilas,
  obtenerConsumosTarjeta,
  obtenerCuotas,
  obtenerDeudaFila,
  obtenerTablaVigente,
  TablaAmortizacionFila,
} from '../../models/finanzas/deuda.model';
import { HttpError } from '../../middlewares/error.middleware';

/**
 * Joi convierte los campos `Joi.date()` del body a objetos Date de JS.
 * mysql2 serializa un Date para columnas DATE usando la timezone local
 * del proceso, lo que corre el día (ej. 2026-12-01 → 2026-11-30 en UTC-5).
 * Se normaliza todo a 'YYYY-MM-DD' vía toISOString() (siempre UTC), que
 * es exactamente lo que representa un Joi.date().iso() sin hora.
 */
function aFechaSql(valor: Date | string): string {
  if (typeof valor === 'string') return valor.slice(0, 10);
  return valor.toISOString().slice(0, 10);
}

/* ===================== Forma que manda/espera Flutter (Deuda.toJson/fromJson) ===================== */

interface ResumenDeudaApi {
  valor: number;
  fecha: string;
  minimo?: number | null;
  corte?: string | null;
  saldo?: number | null;
  restantesCuotas?: number | null;
  tasaAnual?: number | null;
  nota?: string | null;
}

interface ParametrosAmortizacionApi {
  monto: number;
  tasaAnual: number;
  plazoMeses: number;
  fechaInicio: string;
  tipoCuota?: string;
  segDesgravamenTipo?: string;
  segDesgravamenValor?: number;
  otrosSeguros?: number;
  /** generada = con los datos del usuario; subida = archivo del banco. */
  origen?: 'generada' | 'subida';
}

/** Modalidad del consumo tal como la usa la app (prototipo: MODS). */
type ModalidadConsumoApi = 'corriente' | 'dif_con' | 'dif_sin';

interface ConsumoTarjetaApi {
  id?: number;
  fecha: string;
  comercio: string;
  categoriaId?: string | number | null;
  categoriaNombre?: string | null;
  monto: number;
  modalidad: ModalidadConsumoApi;
  plazo?: number;
  /** Meses de gracia antes de la primera cuota (solo diferidos). */
  mesesGracia?: number;
}

/**
 * En la BD la modalidad se separa en tipo_consumo (corriente/diferido) y
 * con_intereses; la app la sigue manejando como un solo valor.
 */
function modalidadApi(c: Pick<ConsumoTarjetaFila, 'tipo_consumo' | 'con_intereses'>): ModalidadConsumoApi {
  if (c.tipo_consumo === 'corriente') return 'corriente';
  return Number(c.con_intereses) === 1 ? 'dif_con' : 'dif_sin';
}

interface CuotaAmortizacionApi {
  numero: number;
  fecha: string;
  capital: number;
  interes: number;
  seguro: number;
  cuota: number;
  saldo: number;
}

export interface DeudaInputApi {
  tipo: string;
  modo: 'resumida' | 'detallada';
  fuenteAcreedorId: string | number;
  alias?: string | null;
  avisoDias?: number;
  categoriaId?: string | number | null;
  resumen?: ResumenDeudaApi | null;
  parametrosAmortizacion?: ParametrosAmortizacionApi | null;
  tablaAmortizacion?: CuotaAmortizacionApi[] | null;
  consumos?: ConsumoTarjetaApi[] | null;
  /** Solo suscripciones: c:<cuenta> · t:<tarjeta> · e:<entidad>. */
  pagaCon?: string | null;
}

export interface DeudaApi {
  id: number;
  tipo: string;
  modo: 'resumida' | 'detallada';
  fuenteAcreedorId: number | null;
  alias: string | null;
  avisoDias: number;
  categoriaId: number | null;
  resumen?: ResumenDeudaApi;
  parametrosAmortizacion?: ParametrosAmortizacionApi;
  tablaAmortizacion?: CuotaAmortizacionApi[];
  consumos?: ConsumoTarjetaApi[];
  pagaCon: string | null;
}

/** Grupo de tipos de crédito cuyo acreedor es una tarjeta (ver TipoCreditoLabel.fuente en Flutter). */
const TIPOS_FUENTE_TARJETA = new Set(['tarjeta']);

function tipoCuotaApiADb(tipoCuota?: string): string {
  return tipoCuota === 'variable' ? 'variable' : 'fijo';
}

function tipoCuotaDbAApi(metodoCuota: string): string {
  return metodoCuota === 'variable' ? 'variable' : 'fija';
}

type DatosParaDb = {
  deuda: DatosDeudaDb;
  tabla: DatosTablaAmortizacionDb | null;
  cuotas: DatosCuotaDb[];
  consumos: DatosConsumoDb[];
};

const r2 = (x: number) => Math.round(x * 100) / 100;

const sql = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

/** Fecha con ese día del mes, ajustada a fin de mes (ej. 31 en abril → 30). */
function enMes(anio: number, mes: number, dia: number): Date {
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(dia, ultimo));
}

/** Próxima fecha (hoy o después) con ese día del mes. */
export function proximaFechaPago(dia: number, hoy = new Date()): string {
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let f = enMes(hoy.getFullYear(), hoy.getMonth(), dia);
  if (f < hoySinHora) f = enMes(hoy.getFullYear(), hoy.getMonth() + 1, dia);
  return sql(f);
}

function sumarMeses(fechaSql: string, meses: number): string {
  const [a, m, d] = fechaSql.split('-').map(Number);
  return sql(enMes(a, m - 1 + meses, d));
}

/**
 * Tarjeta en modo detallado (prototipo: "Consumos de la tarjeta"): la
 * deuda es la suma de los consumos y vence en el próximo día de pago de
 * la tarjeta (o un mes después del último consumo si no lo tiene).
 */
async function datosTarjetaDetallada(
  usuarioId: number,
  input: DeudaInputApi,
  base: Pick<DatosDeudaDb, 'acreedorId' | 'tarjetaCreditoId' | 'alias' | 'avisoDias' | 'categoriaId' | 'tipoDeuda'>,
): Promise<DatosParaDb> {
  const consumosApi = input.consumos || [];
  if (!consumosApi.length) {
    throw new HttpError(422, 'Agrega al menos un consumo');
  }

  // categoria_id es obligatoria en consumos_tarjeta (el schema ya exige que venga).
  const idsCategoria = [...new Set(consumosApi.map((c) => Number(c.categoriaId)))];
  const existentes = await categoriasExistentes(idsCategoria);
  if (idsCategoria.some((id) => !existentes.has(id))) {
    throw new HttpError(400, 'Una de las categorías de los consumos no existe');
  }

  const consumos: DatosConsumoDb[] = consumosApi.map((c) => {
    const corriente = c.modalidad === 'corriente';
    return {
      fecha: aFechaSql(c.fecha),
      comercio: c.comercio.trim(),
      categoriaId: Number(c.categoriaId),
      monto: r2(c.monto),
      tipoConsumo: corriente ? 'corriente' : 'diferido',
      conIntereses: c.modalidad === 'dif_con',
      plazo: corriente ? 1 : Math.max(1, Math.round(c.plazo || 1)),
      mesesGracia: corriente ? 0 : Math.max(0, Math.round(c.mesesGracia || 0)),
    };
  });

  const fechas = consumos.map((c) => c.fecha).sort();
  const total = r2(consumos.reduce((s, c) => s + c.monto, 0));

  const diaPago = await diaPagoTarjeta(usuarioId, Number(input.fuenteAcreedorId));
  if (diaPago === undefined) {
    throw new HttpError(400, 'La tarjeta no existe o no es tuya');
  }
  const vencimiento = diaPago ? proximaFechaPago(diaPago) : sumarMeses(fechas[fechas.length - 1], 1);

  return {
    deuda: {
      ...base,
      descripcion: null,
      montoTotal: total,
      saldoPendiente: total,
      tasaInteres: null,
      fechaInicio: fechas[0],
      fechaVencimiento: vencimiento,
      resumenMinimo: null,
      resumenCorte: null,
      resumenRestantesCuotas: null,
      pagaCon: null,
    },
    tabla: null,
    cuotas: [],
    consumos,
  };
}

async function datosParaDb(usuarioId: number, input: DeudaInputApi): Promise<DatosParaDb> {
  const esTarjeta = TIPOS_FUENTE_TARJETA.has(input.tipo);
  const acreedorId = esTarjeta ? null : Number(input.fuenteAcreedorId);
  const tarjetaCreditoId = esTarjeta ? Number(input.fuenteAcreedorId) : null;
  const categoriaId = input.categoriaId ? Number(input.categoriaId) : null;

  if (input.modo === 'detallada' && esTarjeta) {
    return datosTarjetaDetallada(usuarioId, input, {
      acreedorId,
      tarjetaCreditoId,
      alias: input.alias || null,
      avisoDias: input.avisoDias ?? 3,
      categoriaId,
      tipoDeuda: input.tipo,
    });
  }

  if (input.modo === 'detallada') {
    const params = input.parametrosAmortizacion;
    if (!params) {
      throw new HttpError(422, 'parametrosAmortizacion es obligatorio cuando modo es detallada');
    }
    const cuotasApi = [...(input.tablaAmortizacion || [])].sort((a, b) => a.numero - b.numero);
    if (!cuotasApi.length) {
      throw new HttpError(422, 'Genera o sube la tabla de amortización');
    }
    const ultimaCuota = cuotasApi[cuotasApi.length - 1];
    const origen = params.origen === 'subida' ? 'subida' : 'generada';

    const deuda: DatosDeudaDb = {
      acreedorId,
      tarjetaCreditoId,
      descripcion: null,
      tipoDeuda: input.tipo,
      alias: input.alias || null,
      avisoDias: input.avisoDias ?? 3,
      categoriaId,
      montoTotal: params.monto,
      // Al registrar no hay cuotas pagadas todavía: se debe todo el capital.
      saldoPendiente: params.monto,
      tasaInteres: params.tasaAnual / 100,
      fechaInicio: aFechaSql(params.fechaInicio),
      fechaVencimiento: aFechaSql(ultimaCuota.fecha),
      resumenMinimo: null,
      resumenCorte: null,
      resumenRestantesCuotas: null,
      pagaCon: null,
    };

    const tabla: DatosTablaAmortizacionDb = {
      montoFinanciado: params.monto,
      tasaAnualPct: params.tasaAnual,
      // Tabla del banco: el plazo es el número de cuotas del archivo.
      plazoMeses: origen === 'subida' ? cuotasApi.length : params.plazoMeses,
      fechaInicio: aFechaSql(params.fechaInicio),
      metodoCuota: tipoCuotaApiADb(params.tipoCuota),
      segDesgravamenTipo: params.segDesgravamenTipo || 'fijo',
      segDesgravamenValor: params.segDesgravamenValor ?? 0,
      otrosSeguros: params.otrosSeguros ?? 0,
      origen,
    };

    const cuotas: DatosCuotaDb[] = cuotasApi.map((c) => ({
      numero: c.numero,
      fecha: aFechaSql(c.fecha),
      capital: c.capital,
      interes: c.interes,
      seguro: c.seguro,
      cuota: c.cuota,
      saldo: c.saldo,
    }));

    return { deuda, tabla, cuotas, consumos: [] };
  }

  const resumen = input.resumen;
  if (!resumen) {
    throw new HttpError(422, 'resumen es obligatorio cuando modo es resumida');
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const deuda: DatosDeudaDb = {
    acreedorId,
    tarjetaCreditoId,
    descripcion: resumen.nota || null,
    tipoDeuda: input.tipo,
    alias: input.alias || null,
    avisoDias: input.avisoDias ?? 3,
    categoriaId,
    montoTotal: resumen.valor,
    saldoPendiente: resumen.saldo ?? resumen.valor,
    tasaInteres: resumen.tasaAnual != null ? resumen.tasaAnual / 100 : null,
    fechaInicio: hoy,
    fechaVencimiento: aFechaSql(resumen.fecha),
    resumenMinimo: resumen.minimo ?? null,
    resumenCorte: resumen.corte ? aFechaSql(resumen.corte) : null,
    resumenRestantesCuotas: resumen.restantesCuotas ?? null,
    pagaCon: null,
  };

  return { deuda, tabla: null, cuotas: [], consumos: [] };
}

async function ensamblarApi(fila: DeudaFila): Promise<DeudaApi> {
  const tabla = await obtenerTablaVigente(fila.id);
  const consumos = fila.tipo_deuda === 'tarjeta' ? await obtenerConsumosTarjeta(fila.id) : [];

  const base: DeudaApi = {
    id: fila.id,
    tipo: fila.tipo_deuda,
    // `modo` no es columna: detallada si tiene tabla vigente o consumos.
    modo: tabla || consumos.length ? 'detallada' : 'resumida',
    fuenteAcreedorId: fila.tipo_deuda === 'tarjeta' ? fila.tarjeta_credito_id : fila.acreedor_id,
    alias: fila.alias,
    avisoDias: fila.aviso_dias,
    categoriaId: fila.categoria_id,
    pagaCon: fila.paga_con,
  };

  if (tabla) {
    const cuotas = await obtenerCuotas(tabla.id);
    base.parametrosAmortizacion = aParametrosApi(tabla);
    base.tablaAmortizacion = cuotas.map(aCuotaApi);
  } else if (consumos.length) {
    base.consumos = consumos.map(aConsumoApi);
  } else {
    base.resumen = {
      valor: Number(fila.monto_total),
      fecha: fila.fecha_vencimiento,
      minimo: fila.resumen_minimo !== null ? Number(fila.resumen_minimo) : null,
      corte: fila.resumen_corte,
      saldo: Number(fila.saldo_pendiente),
      restantesCuotas: fila.resumen_restantes_cuotas,
      tasaAnual: fila.tasa_interes !== null ? Number(fila.tasa_interes) * 100 : null,
      nota: fila.descripcion,
    };
  }

  return base;
}

function aParametrosApi(tabla: TablaAmortizacionFila): ParametrosAmortizacionApi {
  return {
    monto: Number(tabla.monto_financiado),
    tasaAnual: Number(tabla.tasa_anual_pct),
    plazoMeses: tabla.plazo_meses,
    fechaInicio: tabla.fecha_inicio,
    tipoCuota: tipoCuotaDbAApi(tabla.metodo_cuota),
    segDesgravamenTipo: tabla.seg_desgravamen_tipo,
    segDesgravamenValor: Number(tabla.seg_desgravamen_valor),
    otrosSeguros: Number(tabla.otros_seguros),
    origen: tabla.origen === 'subida' ? 'subida' : 'generada',
  };
}

function aConsumoApi(c: ConsumoTarjetaFila): ConsumoTarjetaApi {
  return {
    id: c.id,
    fecha: c.fecha_consumo,
    comercio: c.comercio,
    categoriaId: c.categoria_id,
    categoriaNombre: c.categoria_nombre,
    monto: Number(c.monto),
    modalidad: modalidadApi(c),
    plazo: c.plazo_meses,
    mesesGracia: c.meses_gracia,
  };
}

function aCuotaApi(cuota: CuotaAmortizacionFila): CuotaAmortizacionApi {
  return {
    numero: cuota.numero_cuota,
    fecha: cuota.fecha_vencimiento,
    capital: Number(cuota.capital),
    interes: Number(cuota.interes),
    seguro: Number(cuota.seguro),
    cuota: Number(cuota.total_cuota),
    saldo: Number(cuota.saldo_despues),
  };
}

/* ===================== API pública del servicio ===================== */

export async function obtenerDeudasDeUsuario(usuarioId: number): Promise<DeudaApi[]> {
  const filas = await listarDeudasFilas(usuarioId);
  return Promise.all(filas.map(ensamblarApi));
}

export async function obtenerDeuda(usuarioId: number, id: number): Promise<DeudaApi> {
  const fila = await obtenerDeudaFila(usuarioId, id);
  if (!fila) throw new HttpError(404, 'Deuda no encontrada');
  return ensamblarApi(fila);
}

/** Valida y fija "¿Con qué se paga?" (solo suscripciones; el resto, null). */
async function conPagaCon(usuarioId: number, input: DeudaInputApi, datos: DatosParaDb): Promise<DatosParaDb> {
  const ref = input.tipo === 'suscripcion' ? (input.pagaCon || '').trim() : '';
  if (ref && !(await pagaConValido(usuarioId, ref))) {
    throw new HttpError(400, 'La cuenta, tarjeta o entidad con la que se paga no existe o no es tuya');
  }
  return { ...datos, deuda: { ...datos.deuda, pagaCon: ref || null } };
}

export async function registrarDeuda(usuarioId: number, input: DeudaInputApi): Promise<DeudaApi> {
  const { deuda, tabla, cuotas, consumos } = await conPagaCon(usuarioId, input, await datosParaDb(usuarioId, input));
  const id = await insertarDeudaCompleta(usuarioId, deuda, tabla, cuotas, consumos);
  return obtenerDeuda(usuarioId, id);
}

export async function editarDeuda(usuarioId: number, id: number, input: DeudaInputApi): Promise<DeudaApi> {
  const existente = await obtenerDeudaFila(usuarioId, id);
  if (!existente) throw new HttpError(404, 'Deuda no encontrada');
  const { deuda, tabla, cuotas, consumos } = await conPagaCon(usuarioId, input, await datosParaDb(usuarioId, input));
  await actualizarDeudaCompleta(usuarioId, id, deuda, tabla, cuotas, consumos);
  return obtenerDeuda(usuarioId, id);
}

export async function borrarDeuda(usuarioId: number, id: number): Promise<void> {
  const resultado = await eliminarDeudaCompleta(usuarioId, id);
  if (resultado === 'no_existe') throw new HttpError(404, 'Deuda no encontrada');
  if (resultado === 'con_pagos') {
    throw new HttpError(409, 'No se puede eliminar: la deuda tiene pagos registrados');
  }
}
