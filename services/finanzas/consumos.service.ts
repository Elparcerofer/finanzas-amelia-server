/**
 * "Consumos y conciliación" (prototipo Solvenza: renderCons, resPanel,
 * tarjetaPanel, loanPanel, renderAbono): el detalle de cada deuda para
 * cuadrarlo con lo pagado o con el estado de cuenta del banco.
 */
import { HttpError } from '../../middlewares/error.middleware';
import {
  contarConsumos,
  eliminarConsumo,
  guardarPdf,
  guardarValores,
  insertarConsumo,
  leerConciliacion,
  marcarItems,
} from '../../models/finanzas/conciliacion.model';
import { categoriasExistentes } from '../../models/finanzas/deuda.model';
import { extraerMontos, PdfConClave, textoDelPdf } from '../../utils/finanzas/estado_cuenta_pdf';
import { cargarCartera, cargarNombres, deudaRef, movimientoApi, Nombres, obligacionApi, sincronizarResumenDeuda } from './cartera.service';
import { diasHasta, hoyISO, r2, suma } from './motor/fechas';
import {
  cerrada,
  esCuotaFija,
  esPrestamoDetallado,
  esTarjetaDetallada,
  infoDeuda,
  itemsPeriodo,
  pendientes,
  periodoAbierto,
  simularAbono,
  tasaDe,
} from './motor/obligaciones';
import { DeudaMotor } from './motor/tipos';

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

async function deudaOError(usuarioId: number, deudaId: number): Promise<DeudaMotor> {
  const [d] = await cargarCartera(usuarioId, deudaId);
  if (!d) throw new HttpError(404, 'Deuda no encontrada');
  return d;
}

/** Lista de la izquierda: todas las deudas con el monto a pagar más próximo. */
export async function listarDeudas(usuarioId: number) {
  const hoy = hoyISO();
  const [deudas, n] = await Promise.all([cargarCartera(usuarioId), cargarNombres(usuarioId)]);
  return deudas.map((d) => ({
    ...deudaRef(d, n),
    avisoDias: d.avisoDias,
    montoPrincipal: pendientes(d, hoy)[0]?.monto || 0,
  }));
}

/* ------------------------------------------------------------- panel */

export async function panelDeuda(usuarioId: number, deudaId: number, periodo?: string) {
  const hoy = hoyISO();
  const [d, n] = await Promise.all([deudaOError(usuarioId, deudaId), cargarNombres(usuarioId)]);
  const base = { hoy, deuda: { ...deudaRef(d, n), avisoDias: d.avisoDias } };
  if (esTarjetaDetallada(d)) return { ...base, tipoPanel: 'tarjeta' as const, tarjeta: await panelTarjeta(d, n, hoy, periodo) };
  if (esPrestamoDetallado(d)) return { ...base, tipoPanel: 'prestamo' as const, prestamo: panelPrestamo(d, n, hoy) };
  return { ...base, tipoPanel: 'resumida' as const, resumida: panelResumida(d, n, hoy) };
}

function panelResumida(d: DeudaMotor, n: Nombres, hoy: string) {
  const r = d.res!;
  const pend = pendientes(d, hoy)[0];
  return {
    valor: r.valor,
    abonado: r.abonado,
    fecha: r.fecha,
    diasHasta: diasHasta(r.fecha, hoy),
    estado: d.estado || 'pendiente',
    minimo: r.minimo,
    saldo: r.saldo,
    restantes: r.restantes,
    corte: r.corte,
    nota: r.nota,
    pendiente: pend ? obligacionApi(d, pend, hoy, n) : null,
    movimientos: [...d.movs].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).map((m) => movimientoApi(d, m, n)),
  };
}

function panelPrestamo(d: DeudaMotor, n: Nombres, hoy: string) {
  const R = d.amort!.rows;
  const inf = infoDeuda(d, hoy);
  const pagadoDe = (n2: number) => d.pagosCuota[n2] || 0;
  const pagada = (r: (typeof R)[number]) => pagadoDe(r.n) >= r.cuota - 0.01;
  const pend = pendientes(d, hoy);
  const prox = pend[0];
  const filas = R.map((r) => {
    const v = pagadoDe(r.n);
    const estado = r.liq ? 'liquidada' : pagada(r) ? 'pagada' : v > 0 ? 'parcial' : diasHasta(r.fecha, hoy) < 0 ? 'vencida' : 'pendiente';
    return { ...r, liq: !!r.liq, pagado: v, estado, clave: `c:${r.n}`, pagable: pend.some((x) => x.clave === `c:${r.n}`) };
  });
  let ultimaPagada = 0;
  for (const r of R) if (pagada(r)) ultimaPagada = r.n;
  return {
    origen: d.amort!.params.origen === 'subida' ? 'importada' : 'generada',
    cuotaFija: esCuotaFija(R),
    tasa: tasaDe(d) || null,
    saldoCapital: inf.saldoCapital,
    cuotasPagadas: R.filter(pagada).length,
    totalCuotas: R.length,
    ultimaPagada,
    proxima: prox ? obligacionApi(d, prox, hoy, n) : null,
    interesPagado: r2(suma(d.movs, (m) => m.partes.interes)),
    interesPorPagar: inf.interesPorPagar,
    liquidada: d.estado === 'liquidada',
    pagada: cerrada(d),
    filas,
  };
}

async function panelTarjeta(d: DeudaMotor, n: Nombres, hoy: string, periodo?: string) {
  const per = periodo && PERIODO.test(periodo) ? periodo : periodoAbierto(d, hoy);
  const items = itemsPeriodo(d, per);
  const c = await leerConciliacion(d.id, per);
  const enPdf = (v: number) => c.montos.some((a) => Math.abs(a - v) <= 0.01);
  const corriente = r2(suma(items.filter((x) => !x.cuotaN), (x) => x.valor));
  const diferido = r2(suma(items.filter((x) => x.cuotaN), (x) => x.valor));
  const pend = pendientes(d, hoy).find((x) => x.per === per);
  return {
    periodo: per,
    corte: d.tarjeta?.corte || null,
    items: items.map((x) => ({
      clave: x.key,
      consumoId: x.c.id,
      fecha: x.c.fecha,
      comercio: x.c.comercio,
      categoria: x.c.categoriaNombre || 'Sin categoría',
      modalidad: x.c.mod,
      cuota: x.cuotaN,
      montoOriginal: x.cuotaN ? x.c.monto : null,
      valor: x.valor,
      conciliado: c.conciliados.includes(x.key),
      // null = no se ha subido el PDF de este período.
      enPdf: c.montos.length ? enPdf(x.valor) || enPdf(x.c.monto) : null,
    })),
    totales: { corriente, diferido, total: r2(corriente + diferido) },
    conciliacion: {
      valorEstado: c.valorEstado,
      // Lo realmente pagado: lo que el usuario anotó o, si no, lo registrado en pagos.
      pagoReal: c.pagoReal ?? (d.concil[per]?.pagado || null),
      fechaPago: c.fechaPago ?? d.concil[per]?.fechaPago ?? null,
      pdfNombre: c.pdfNombre,
      montos: c.montos,
      sugeridos: c.sugeridos,
    },
    pendiente: pend ? obligacionApi(d, pend, hoy, n) : null,
  };
}

/** Compara abonar a capital reduciendo plazo vs. cuota (prototipo: renderAbono). */
export async function simularAbonoPrestamo(usuarioId: number, deudaId: number, monto: number, despues: number) {
  const d = await deudaOError(usuarioId, deudaId);
  if (!esPrestamoDetallado(d)) throw new HttpError(422, 'Solo los créditos con tabla de amortización admiten abono a capital');
  const R = d.amort!.rows;
  if (despues < 0 || despues >= R.length) throw new HttpError(422, 'Cuota fuera de rango');
  const tasa = tasaDe(d);
  return {
    tasa: tasa || null,
    plazo: simularAbono(R, tasa, despues, monto, 'plazo'),
    cuota: simularAbono(R, tasa, despues, monto, 'cuota'),
  };
}

/* ---------------------------------------------------------- consumos */

async function tarjetaDetalladaOError(usuarioId: number, deudaId: number): Promise<DeudaMotor> {
  const d = await deudaOError(usuarioId, deudaId);
  if (!esTarjetaDetallada(d)) throw new HttpError(422, 'Esta deuda no se registra consumo por consumo');
  return d;
}

export interface ConsumoInput {
  fecha: string | Date;
  comercio: string;
  categoriaId: number;
  monto: number;
  modalidad: 'corriente' | 'dif_con' | 'dif_sin';
  plazo?: number;
  mesesGracia?: number;
}

export async function agregarConsumo(usuarioId: number, deudaId: number, c: ConsumoInput) {
  await tarjetaDetalladaOError(usuarioId, deudaId);
  if (!(await categoriasExistentes([c.categoriaId])).has(c.categoriaId)) throw new HttpError(400, 'La categoría no existe');
  const corriente = c.modalidad === 'corriente';
  await insertarConsumo(deudaId, {
    fecha: typeof c.fecha === 'string' ? c.fecha.slice(0, 10) : c.fecha.toISOString().slice(0, 10),
    comercio: c.comercio.trim(),
    categoriaId: c.categoriaId,
    monto: r2(c.monto),
    tipoConsumo: corriente ? 'corriente' : 'diferido',
    conIntereses: c.modalidad === 'dif_con',
    plazo: corriente ? 1 : Math.max(1, Math.round(c.plazo || 1)),
    mesesGracia: corriente ? 0 : Math.max(0, Math.round(c.mesesGracia || 0)),
  });
  await sincronizarResumenDeuda(usuarioId, deudaId);
}

export async function quitarConsumo(usuarioId: number, deudaId: number, consumoId: number) {
  await tarjetaDetalladaOError(usuarioId, deudaId);
  if ((await contarConsumos(deudaId)) <= 1) {
    throw new HttpError(409, 'La deuda necesita al menos un consumo. Si ya no la usas, elimina la deuda.');
  }
  if (!(await eliminarConsumo(deudaId, consumoId))) throw new HttpError(404, 'Consumo no encontrado');
  await sincronizarResumenDeuda(usuarioId, deudaId);
}

/* ------------------------------------------------------- conciliación */

function periodoOError(periodo: string): string {
  if (!PERIODO.test(periodo)) throw new HttpError(400, 'Período no válido (YYYY-MM)');
  return periodo;
}

export async function guardarConciliacion(
  usuarioId: number,
  deudaId: number,
  periodo: string,
  v: { valorEstado?: number | null; pagoReal?: number | null; fechaPago?: string | Date | null },
) {
  await tarjetaDetalladaOError(usuarioId, deudaId);
  const f = v.fechaPago ? (typeof v.fechaPago === 'string' ? v.fechaPago.slice(0, 10) : v.fechaPago.toISOString().slice(0, 10)) : null;
  await guardarValores(usuarioId, deudaId, periodoOError(periodo), {
    valorEstado: v.valorEstado ?? null,
    pagoReal: v.pagoReal ?? null,
    fechaPago: f,
  });
}

export async function conciliarItems(usuarioId: number, deudaId: number, periodo: string, claves: string[], conciliado: boolean) {
  await tarjetaDetalladaOError(usuarioId, deudaId);
  await marcarItems(usuarioId, deudaId, periodoOError(periodo), claves, conciliado);
}

/** Lee el PDF del estado de cuenta (no se guarda el archivo ni la clave). */
export async function leerPdfEstadoCuenta(
  usuarioId: number,
  deudaId: number,
  periodo: string,
  nombre: string,
  base64: string,
  clave?: string | null,
) {
  await tarjetaDetalladaOError(usuarioId, deudaId);
  const datos = new Uint8Array(Buffer.from(base64, 'base64'));
  if (!datos.length) throw new HttpError(400, 'El archivo está vacío');
  let texto: string;
  try {
    texto = await textoDelPdf(datos, clave);
  } catch (e) {
    if (e instanceof PdfConClave) {
      // 423: la app pide la clave (en muchos bancos es la cédula) y reintenta.
      throw new HttpError(423, e.incorrecta ? 'Contraseña incorrecta. Intenta de nuevo' : 'El PDF tiene contraseña');
    }
    throw new HttpError(422, 'No pude leer el PDF');
  }
  const { montos, sugeridos } = extraerMontos(texto);
  await guardarPdf(usuarioId, deudaId, periodoOError(periodo), nombre.slice(0, 255), montos, sugeridos);
  return { montos: montos.length, sugeridos };
}
