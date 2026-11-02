import {
  actualizarDeudaCompleta,
  CuotaAmortizacionFila,
  DatosCuotaDb,
  DatosDeudaDb,
  DatosTablaAmortizacionDb,
  DeudaFila,
  eliminarDeudaCompleta,
  insertarDeudaCompleta,
  listarDeudasFilas,
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
}

/** Grupo de tipos de crédito cuyo acreedor es una tarjeta (ver TipoCreditoLabel.fuente en Flutter). */
const TIPOS_FUENTE_TARJETA = new Set(['tarjeta']);

function tipoCuotaApiADb(tipoCuota?: string): string {
  return tipoCuota === 'variable' ? 'variable' : 'fijo';
}

function tipoCuotaDbAApi(metodoCuota: string): string {
  return metodoCuota === 'variable' ? 'variable' : 'fija';
}

function datosParaDb(usuarioId: number, input: DeudaInputApi): { deuda: DatosDeudaDb; tabla: DatosTablaAmortizacionDb | null; cuotas: DatosCuotaDb[] } {
  const esTarjeta = TIPOS_FUENTE_TARJETA.has(input.tipo);
  const catalogoId = esTarjeta ? null : Number(input.fuenteAcreedorId);
  const tarjetaCreditoId = esTarjeta ? Number(input.fuenteAcreedorId) : null;
  const categoriaId = input.categoriaId ? Number(input.categoriaId) : null;

  if (input.modo === 'detallada') {
    const params = input.parametrosAmortizacion;
    if (!params) {
      throw new HttpError(422, 'parametrosAmortizacion es obligatorio cuando modo es detallada');
    }
    const cuotasApi = input.tablaAmortizacion || [];
    const ultimaCuota = cuotasApi[cuotasApi.length - 1];

    const deuda: DatosDeudaDb = {
      catalogoId,
      tarjetaCreditoId,
      descripcion: null,
      tipoDeuda: input.tipo,
      alias: input.alias || null,
      avisoDias: input.avisoDias ?? 3,
      categoriaId,
      montoTotal: params.monto,
      saldoPendiente: ultimaCuota ? ultimaCuota.saldo : params.monto,
      tasaInteres: params.tasaAnual / 100,
      fechaInicio: aFechaSql(params.fechaInicio),
      fechaVencimiento: aFechaSql(ultimaCuota ? ultimaCuota.fecha : params.fechaInicio),
      resumenMinimo: null,
      resumenCorte: null,
      resumenRestantesCuotas: null,
    };

    const tabla: DatosTablaAmortizacionDb = {
      montoFinanciado: params.monto,
      tasaAnualPct: params.tasaAnual,
      plazoMeses: params.plazoMeses,
      fechaInicio: aFechaSql(params.fechaInicio),
      metodoCuota: tipoCuotaApiADb(params.tipoCuota),
      segDesgravamenTipo: params.segDesgravamenTipo || 'fijo',
      segDesgravamenValor: params.segDesgravamenValor ?? 0,
      otrosSeguros: params.otrosSeguros ?? 0,
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

    return { deuda, tabla, cuotas };
  }

  const resumen = input.resumen;
  if (!resumen) {
    throw new HttpError(422, 'resumen es obligatorio cuando modo es resumida');
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const deuda: DatosDeudaDb = {
    catalogoId,
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
  };

  return { deuda, tabla: null, cuotas: [] };
}

async function ensamblarApi(fila: DeudaFila): Promise<DeudaApi> {
  const tabla = await obtenerTablaVigente(fila.id);

  const base: DeudaApi = {
    id: fila.id,
    tipo: fila.tipo_deuda,
    modo: tabla ? 'detallada' : 'resumida',
    fuenteAcreedorId: fila.tipo_deuda === 'tarjeta' ? fila.tarjeta_credito_id : fila.catalogo_id,
    alias: fila.alias,
    avisoDias: fila.aviso_dias,
    categoriaId: fila.categoria_id,
  };

  if (tabla) {
    const cuotas = await obtenerCuotas(tabla.id);
    base.parametrosAmortizacion = aParametrosApi(tabla);
    base.tablaAmortizacion = cuotas.map(aCuotaApi);
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

export async function registrarDeuda(usuarioId: number, input: DeudaInputApi): Promise<DeudaApi> {
  const { deuda, tabla, cuotas } = datosParaDb(usuarioId, input);
  const id = await insertarDeudaCompleta(usuarioId, deuda, tabla, cuotas);
  return obtenerDeuda(usuarioId, id);
}

export async function editarDeuda(usuarioId: number, id: number, input: DeudaInputApi): Promise<DeudaApi> {
  const existente = await obtenerDeudaFila(usuarioId, id);
  if (!existente) throw new HttpError(404, 'Deuda no encontrada');
  const { deuda, tabla, cuotas } = datosParaDb(usuarioId, input);
  await actualizarDeudaCompleta(usuarioId, id, deuda, tabla, cuotas);
  return obtenerDeuda(usuarioId, id);
}

export async function borrarDeuda(usuarioId: number, id: number): Promise<void> {
  const eliminada = await eliminarDeudaCompleta(usuarioId, id);
  if (!eliminada) throw new HttpError(404, 'Deuda no encontrada');
}
