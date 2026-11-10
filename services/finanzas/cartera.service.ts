/**
 * Cartera de deudas del usuario con su estado ACTUAL: arma el modelo del
 * motor desde la BD y reproduce los pagos registrados. Es la base de
 * Registrar pago, Detalle de pago, Inicio, Calendario y Reportes.
 */
import { RowDataPacket } from 'mysql2';
import pool from '../../database/pool';
import { Cartera, leerCartera, PagoCarteraFila } from '../../models/finanzas/cartera.model';
import { aplicarPago, PagoInvalido } from './motor/aplicar';
import { diasHasta, hoyISO, r2 } from './motor/fechas';
import { infoDeuda, moraEstimada } from './motor/obligaciones';
import {
  Accion,
  DeudaMotor,
  ETIQUETA_ACCION,
  ETIQUETA_CARGO,
  ETIQUETA_TIPO,
  fuenteDe,
  Movimiento,
  Obligacion,
  TipoCargo,
  TipoCredito,
} from './motor/tipos';

/* ------------------------------------------------------- medios de pago */

export const MEDIOS: [string, string][] = [
  ['transferencia', 'Transferencia'],
  ['banca_movil', 'Banca móvil'],
  ['debito_automatico', 'Débito automático'],
  ['tarjeta_debito', 'Tarjeta de débito'],
  ['tarjeta_credito', 'Tarjeta de crédito'],
  ['efectivo', 'Ventanilla / efectivo'],
  ['tercero', 'Pagó un tercero'],
  ['otro', 'Otro'],
];
export const etiquetaMedio = (c: string): string => MEDIOS.find((m) => m[0] === c)?.[1] || c;

/* ------------------------------------------------------- construcción */

const num = (v: string | number | null | undefined): number => Number(v) || 0;
const numN = (v: string | number | null | undefined): number | null => (v == null || v === '' ? null : Number(v));

function construir(c: Cartera): DeudaMotor[] {
  const tarjetas = new Map(c.tarjetas.map((t) => [t.id, t]));
  const tablaDe = new Map(c.tablas.map((t) => [t.deuda_id, t]));

  return c.deudas.map((f) => {
    const tipo = f.tipo_deuda as TipoCredito;
    const t = f.tarjeta_credito_id ? tarjetas.get(f.tarjeta_credito_id) : undefined;
    const tabla = tablaDe.get(f.id);
    const consumos = c.consumos.filter((x) => x.deuda_id === f.id);

    const tarjeta = t
      ? {
          id: t.id,
          nombre: t.nombre,
          emisor: t.emisor || '',
          entidadId: t.entidad_id,
          ult4: t.ultimos4,
          cupo: num(t.cupo),
          corte: t.dia_corte || 0,
          diaPago: t.dia_pago || 0,
          tasa: num(t.tasa_anual_pct),
          color: t.color,
          marca: t.marca,
          propiedad: t.propiedad,
        }
      : null;

    const amort = tabla
      ? {
          params: {
            tasa: num(tabla.tasa_anual_pct),
            inicio: tabla.fecha_inicio,
            desgTipo: tabla.seg_desgravamen_tipo,
            desgVal: num(tabla.seg_desgravamen_valor),
            otrosSeg: num(tabla.otros_seguros),
            origen: tabla.origen || 'generada',
          },
          rows: c.cuotas
            .filter((q) => q.tabla_amortizacion_id === tabla.id)
            .map((q) => ({
              n: q.numero_cuota,
              fecha: q.fecha_vencimiento,
              capital: num(q.capital),
              interes: num(q.interes),
              seguro: num(q.seguro),
              cuota: num(q.total_cuota),
              saldo: num(q.saldo_despues),
            })),
        }
      : null;

    const detallada = !!amort || consumos.length > 0;
    const refNombre = tarjeta
      ? `${tarjeta.emisor} · ${tarjeta.nombre}${tarjeta.ult4 ? ' ••' + tarjeta.ult4 : ''}`
      : f.acreedor_nombre || '(acreedor eliminado)';

    const d: DeudaMotor = {
      id: f.id,
      tipo,
      modo: detallada ? 'detallada' : 'resumida',
      fuente: fuenteDe(tipo),
      alias: f.alias,
      acreedorId: f.acreedor_id,
      acreedorNombre: refNombre,
      acreedorSubtipo: f.acreedor_subtipo,
      credNombre: tarjeta ? tarjeta.emisor : f.acreedor_nombre || '—',
      credId: tarjeta ? tarjeta.entidadId : f.acreedor_id,
      credWeb: t ? t.emisor_web : f.acreedor_web,
      credLogo: t ? t.emisor_logo : f.acreedor_logo,
      tarjeta,
      categoriaId: f.categoria_id,
      pagaCon: f.paga_con,
      avisoDias: f.aviso_dias,
      creado: f.creado_en,
      estado: '',
      amort,
      pagosCuota: {},
      consumos: consumos.map((x) => ({
        id: x.id,
        fecha: x.fecha_consumo,
        comercio: x.comercio,
        categoriaId: x.categoria_id,
        categoriaNombre: x.categoria_nombre,
        monto: num(x.monto),
        mod: x.tipo_consumo === 'corriente' ? 'corriente' : Number(x.con_intereses) === 1 ? 'dif_con' : 'dif_sin',
        plazo: x.plazo_meses || 1,
        gracia: x.meses_gracia || 0,
      })),
      concil: {},
      res: detallada
        ? null
        : {
            valor: num(f.monto_total),
            corte: f.resumen_corte,
            nota: f.descripcion,
            fecha: f.fecha_vencimiento,
            minimo: numN(f.resumen_minimo),
            // El saldo informado y las cuotas restantes son los del
            // registro; los pagos los van bajando al reproducirse.
            saldo: tipo === 'tarjeta' || tipo === 'suscripcion' ? null : numN(f.resumen_saldo),
            restantes: f.resumen_restantes_cuotas,
            tasa: f.tasa_interes != null ? num(f.tasa_interes) * 100 : 0,
            abonado: 0,
          },
      liq: null,
      movs: [],
    };
    return d;
  });
}

/** Pasa una fila de pagos a movimiento (con sus categorías y cargos). */
function aMovimiento(p: PagoCarteraFila, c: Cartera): Movimiento {
  const cats = c.pagosCategorias.filter((x) => x.pago_id === p.id);
  const cargos = c.pagosCargos.filter((x) => x.pago_id === p.id);
  const origen =
    p.origen_cuenta_id || p.origen_tarjeta_id || p.origen_agencia || p.origen_tercero
      ? {
          cuentaId: p.origen_cuenta_id,
          tarjetaId: p.origen_tarjeta_id,
          agencia: p.origen_agencia,
          tercero: p.origen_tercero,
          relacion: p.origen_relacion,
        }
      : null;
  return {
    id: p.id,
    fecha: p.fecha_pago,
    accion: p.accion as Accion,
    monto: num(p.monto),
    fechaVence: p.fecha_vence,
    clave: p.clave,
    modoAbono: p.modo_abono === 'cuota' ? 'cuota' : p.modo_abono === 'plazo' ? 'plazo' : null,
    desc: p.descripcion || '',
    medio: p.metodo_pago,
    ref: p.comprobante,
    origen,
    cats: cats.length ? Object.fromEntries(cats.map((x) => [x.categoria_id, num(x.monto)])) : null,
    cargos: cargos.length ? Object.fromEntries(cargos.map((x) => [x.tipo, num(x.monto)])) : null,
    partes: {
      capital: num(p.parte_capital),
      interes: num(p.parte_interes),
      seguro: num(p.parte_seguro),
      cargos: num(p.parte_recargos),
    },
    antes: p.saldo_antes != null ? { saldo: num(p.saldo_antes), total: num(p.total_antes) } : null,
    despues: p.saldo_despues != null ? { saldo: num(p.saldo_despues), total: num(p.total_despues) } : null,
  };
}

/** Reproduce los pagos sobre las deudas (en el orden en que se registraron). */
function reproducir(deudas: DeudaMotor[], c: Cartera): void {
  const porId = new Map(deudas.map((d) => [d.id, d]));
  for (const p of c.pagos) {
    const d = porId.get(p.deuda_id);
    if (!d) continue;
    const mov = aMovimiento(p, c);
    try {
      aplicarPago(d, {
        accion: mov.accion,
        clave: mov.clave,
        monto: r2(mov.monto - (mov.partes.cargos || 0)),
        fecha: mov.fecha,
        modoAbono: mov.modoAbono,
      });
    } catch (e) {
      // Pagos anteriores al motor (sin clave) o que ya no calzan con la
      // deuda editada: se conservan en el historial pero no la mueven.
      if (!(e instanceof PagoInvalido)) throw e;
    }
    d.movs.push(mov);
  }
}

/**
 * Deudas del usuario (o solo una) con su estado actual. `sinPagoId`
 * reproduce todos los pagos menos ese (para saber cómo queda la deuda
 * al anularlo).
 */
export async function cargarCartera(usuarioId: number, soloDeudaId?: number, sinPagoId?: number): Promise<DeudaMotor[]> {
  const c = await leerCartera(usuarioId, soloDeudaId);
  if (sinPagoId) c.pagos = c.pagos.filter((p) => p.id !== sinPagoId);
  const deudas = construir(c);
  reproducir(deudas, c);
  return deudas;
}

/* ------------------------------------------------ nombres de referencia */

export interface Nombres {
  cuentas: Map<number, { nombre: string; tercero: boolean; tipo: string }>;
  tarjetas: Map<number, { nombre: string; tercero: boolean }>;
  entidades: Map<number, string>;
  categorias: Map<number, { nombre: string; emoji: string | null; color: string | null; subtipo: string | null; grupo: string | null; activo: boolean; codigo: string | null; sistema: boolean }>;
  /** id de las categorías con código (intereses, seguros, multas, sin_categoria…). */
  porCodigo: Map<string, number>;
}

const sinBanco = (s: string): string => s.replace(/^Banco (del |de )?/, '');

export async function cargarNombres(usuarioId: number): Promise<Nombres> {
  const [[cuentas], [tarjetas], [categorias]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      'SELECT id, alias, ultimos4, propiedad, titular, tipo_cuenta FROM cuentas WHERE usuario_id = ?',
      [usuarioId],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT t.id, t.nombre, t.ultimos4, t.propiedad, e.nombre AS emisor
       FROM tarjetas_credito t LEFT JOIN catalogos e ON e.id = t.entidad_id WHERE t.usuario_id = ?`,
      [usuarioId],
    ),
    pool.query<RowDataPacket[]>('SELECT id, codigo, nombre, emoji, color, subtipo, grupo, activo, sistema FROM categorias'),
  ]);
  const [entidades] = await pool.query<RowDataPacket[]>("SELECT id, nombre FROM catalogos WHERE tipo = 'banco'");
  const tercero = (p: string | null) => (p || '').toLowerCase().includes('tercer');
  return {
    cuentas: new Map(
      cuentas.map((x) => [
        Number(x.id),
        {
          nombre: `${x.alias}${x.ultimos4 ? ' ••' + x.ultimos4 : ''}${tercero(x.propiedad) ? ` (de ${x.titular || 'tercero'})` : ''}`,
          tercero: tercero(x.propiedad),
          tipo: String(x.tipo_cuenta || ''),
        },
      ]),
    ),
    tarjetas: new Map(
      tarjetas.map((x) => [
        Number(x.id),
        {
          nombre: `${sinBanco(String(x.emisor || ''))} · ${x.nombre}${x.ultimos4 ? ' ••' + x.ultimos4 : ''}`,
          tercero: tercero(x.propiedad),
        },
      ]),
    ),
    entidades: new Map(entidades.map((x) => [Number(x.id), String(x.nombre)])),
    porCodigo: new Map(categorias.filter((x) => x.codigo).map((x) => [String(x.codigo), Number(x.id)])),
    categorias: new Map(
      categorias.map((x) => [
        Number(x.id),
        { nombre: String(x.nombre), emoji: x.emoji, color: x.color, subtipo: x.subtipo, grupo: x.grupo, activo: Number(x.activo) === 1, codigo: x.codigo, sistema: Number(x.sistema) === 1 },
      ]),
    ),
  };
}

export function nombrePagaCon(v: string | null, n: Nombres): string | null {
  if (!v) return null;
  const [k, idTxt] = v.split(':');
  const id = Number(idTxt);
  if (k === 't') return n.tarjetas.get(id)?.nombre || '—';
  if (k === 'c') return n.cuentas.get(id)?.nombre || '—';
  const e = n.entidades.get(id);
  return e ? `Cuenta ${e}` : '—';
}

/* ------------------------------------------------------------ salidas */

export interface DeudaRefApi {
  id: number;
  nombre: string;
  tipo: string;
  tipoEtiqueta: string;
  modo: 'resumida' | 'detallada';
  refNombre: string;
  credNombre: string;
  credId: number | null;
  /** Catálogo donde está el logo del acreedor (entidades o empresas). */
  credFuente: 'entidades' | 'empresas';
  credWeb: string | null;
  credLogo: string | null;
  pagaCon: string | null;
  pagaConNombre: string | null;
  estado: string;
}

export function deudaRef(d: DeudaMotor, n: Nombres): DeudaRefApi {
  return {
    id: d.id,
    nombre: d.alias || d.acreedorNombre,
    tipo: d.tipo,
    tipoEtiqueta: ETIQUETA_TIPO[d.tipo] || d.tipo,
    modo: d.modo,
    refNombre: d.acreedorNombre,
    credNombre: d.credNombre,
    credId: d.credId,
    credFuente: d.fuente === 'empresas' ? 'empresas' : 'entidades',
    credWeb: d.credWeb,
    credLogo: d.credLogo,
    pagaCon: d.pagaCon,
    pagaConNombre: nombrePagaCon(d.pagaCon, n),
    estado: d.estado || 'pendiente',
  };
}

export interface ObligacionApi extends Obligacion {
  diasHasta: number;
  mora: number;
  deuda: DeudaRefApi;
}

export function obligacionApi(d: DeudaMotor, it: Obligacion, hoy: string, n: Nombres): ObligacionApi {
  const dias = diasHasta(it.fecha, hoy);
  return { ...it, diasHasta: dias, mora: dias < 0 ? moraEstimada(d, it, hoy) : 0, deuda: deudaRef(d, n) };
}

/** Texto del origen del dinero (prototipo: origenTxt). */
export function origenTexto(m: Movimiento, n: Nombres): string {
  const o = m.origen;
  if (!o) return '';
  const cuenta = o.cuentaId ? n.cuentas.get(o.cuentaId)?.nombre : null;
  const tarjeta = o.tarjetaId ? n.tarjetas.get(o.tarjetaId)?.nombre : null;
  const partes: string[] = [];
  if (o.tercero) partes.push(`pagó ${o.tercero}${o.relacion ? ` (${o.relacion.toLowerCase()})` : ''}`);
  else if (cuenta) partes.push(cuenta);
  else if (tarjeta) partes.push(tarjeta);
  if (o.agencia) partes.push(o.agencia);
  return partes.join(' · ');
}

export interface MovimientoApi {
  id: number;
  fecha: string;
  accion: Accion;
  accionEtiqueta: string;
  monto: number;
  fechaVence: string | null;
  desc: string;
  medio: string;
  medioEtiqueta: string;
  ref: string | null;
  origen: Movimiento['origen'];
  origenTexto: string;
  categorias: { categoriaId: number; nombre: string; emoji: string | null; monto: number }[];
  cargos: { tipo: TipoCargo; etiqueta: string; monto: number }[];
  partes: { capital: number; interes: number; seguro: number; cargos: number };
  antes: Movimiento['antes'];
  despues: Movimiento['despues'];
  /** null si no tenía vencimiento; si no, días de atraso (≤ 0 = a tiempo). */
  diasAtraso: number | null;
  /** Solo el último pago de cada deuda se puede anular. */
  anulable: boolean;
  deuda: DeudaRefApi;
}

export function movimientoApi(d: DeudaMotor, m: Movimiento, n: Nombres): MovimientoApi {
  const ultimo = d.movs[d.movs.length - 1];
  return {
    id: m.id,
    fecha: m.fecha,
    accion: m.accion,
    accionEtiqueta: ETIQUETA_ACCION[m.accion] || m.accion,
    monto: m.monto,
    fechaVence: m.fechaVence,
    desc: m.desc,
    medio: m.medio,
    medioEtiqueta: etiquetaMedio(m.medio),
    ref: m.ref,
    origen: m.origen,
    origenTexto: origenTexto(m, n),
    categorias: Object.entries(m.cats || {}).map(([id, monto]) => {
      const c = n.categorias.get(Number(id));
      return { categoriaId: Number(id), nombre: c?.nombre || '—', emoji: c?.emoji || null, monto };
    }),
    cargos: Object.entries(m.cargos || {}).map(([tipo, monto]) => ({
      tipo: tipo as TipoCargo,
      etiqueta: ETIQUETA_CARGO[tipo as TipoCargo] || tipo,
      monto: monto as number,
    })),
    partes: {
      capital: m.partes.capital,
      interes: m.partes.interes,
      seguro: m.partes.seguro,
      cargos: m.partes.cargos || 0,
    },
    antes: m.antes,
    despues: m.despues,
    diasAtraso: m.fechaVence ? diasHasta(m.fechaVence, m.fecha) * -1 : null,
    anulable: ultimo === m,
    deuda: deudaRef(d, n),
  };
}

/** Resumen de costos de un conjunto de pagos (prototipo: costSummaryHTML). */
export function resumenCostos(ms: Movimiento[]) {
  const t = (k: 'capital' | 'interes' | 'seguro' | 'cargos') => r2(ms.reduce((s, m) => s + (m.partes[k] || 0), 0));
  const capital = t('capital');
  const interes = t('interes');
  const seguro = t('seguro');
  const cargos = t('cargos');
  return {
    pagos: ms.length,
    total: r2(ms.reduce((s, m) => s + m.monto, 0)),
    capital,
    interes,
    seguro,
    cargos,
    costo: r2(interes + seguro + cargos),
  };
}

/** Estado resumido que se guarda en deudas.estado / saldo_pendiente. */
export function estadoParaDb(d: DeudaMotor, hoy = hoyISO()): { estado: string; saldo: number } {
  const inf = infoDeuda(d, hoy);
  const estado = d.estado === 'liquidada' ? 'liquidada' : d.estado === 'pagada' ? 'pagada' : inf.vencido > 0 ? 'vencida' : 'pendiente';
  return { estado, saldo: r2(inf.saldoCapital) };
}

/** Recalcula deudas.estado / saldo_pendiente (tras registrar o editar la deuda). */
export async function sincronizarResumenDeuda(usuarioId: number, deudaId: number): Promise<void> {
  const [d] = await cargarCartera(usuarioId, deudaId);
  if (!d) return;
  const { estado, saldo } = estadoParaDb(d);
  await pool.query('UPDATE deudas SET estado = ?, saldo_pendiente = ? WHERE id = ? AND usuario_id = ?', [
    estado,
    saldo,
    deudaId,
    usuarioId,
  ]);
}
