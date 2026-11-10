/**
 * Registrar ingresos y capacidad de pago (prototipo Solvenza: renderIng,
 * capacidadCalc, ingresoMes, ingresoFijo).
 */
import { HttpError } from '../../middlewares/error.middleware';
import { cuentaEsDelUsuario } from '../../models/finanzas/cartera.model';
import {
  actualizarIngreso,
  ClaseIngreso,
  crearIngreso,
  eliminarIngreso,
  fuenteExiste,
  IngresoDb,
  IngresoFila,
  ingresoDelPerfil,
  listarFuentes,
  listarIngresosPorUsuario,
  obtenerIngresoPorId,
} from '../../models/finanzas/ingreso.model';
import { cargarCartera, cargarNombres, Nombres } from './cartera.service';
import { hoyISO, periodoSiguiente, r2, suma } from './motor/fechas';
import { cerrada, cuotaFijaMensual, cuotasPagadasSeguidas, esPrestamoDetallado, infoDeuda, simularAbono, tasaDe } from './motor/obligaciones';
import { pagadoEnMes, proyeccion } from './motor/proyeccion';
import { DeudaMotor } from './motor/tipos';

/** Límite saludable de cuotas fijas sobre el ingreso fijo. */
export const LIMITE_ENDEUDAMIENTO = 0.35;

export const ETIQUETA_CLASE: Record<ClaseIngreso, string> = {
  fijo: 'Fijo mensual',
  extra: 'Extraordinario',
  variable: 'Variable',
  activo: 'Venta de activos',
  otro: 'Otros',
  prestamo: 'No es ingreso',
};

/* ------------------------------------------------------- cálculos */

/** Lo recibido en el mes `per` (los mensuales cuentan desde su fecha hasta `hasta`). Los préstamos no son ingreso. */
export function ingresoMes(ingresos: IngresoFila[], per: string): number {
  return r2(
    suma(ingresos, (i) => {
      if (i.clase === 'prestamo') return 0;
      const m = i.fecha.slice(0, 7);
      if (i.periodicidad === 'mensual') return m <= per && (!i.hasta || i.hasta >= per) ? Number(i.monto) : 0;
      return m === per ? Number(i.monto) : 0;
    }),
  );
}

/** Ingreso fijo mensual vigente en el mes `per`. */
export function ingresoFijo(ingresos: IngresoFila[], per: string): number {
  return r2(
    suma(ingresos, (i) =>
      i.periodicidad === 'mensual' && i.clase !== 'prestamo' && i.fecha.slice(0, 7) <= per && (!i.hasta || i.hasta >= per)
        ? Number(i.monto)
        : 0,
    ),
  );
}

/** Ingreso fijo registrado o, si no hay, el estimado del perfil. */
export async function ingresoBase(usuarioId: number, ingresos: IngresoFila[], hoy = hoyISO()): Promise<number> {
  return ingresoFijo(ingresos, hoy.slice(0, 7)) || (await ingresoDelPerfil(usuarioId));
}

export type Tono = 'ok' | 'warn' | 'bad' | 'info';

export interface Recomendacion {
  tono: Tono;
  /** Texto con los montos marcados entre ** para resaltarlos en la app. */
  texto: string;
}

const fmt = (x: number): string =>
  (x < 0 ? '−' : '') + '$' + Math.abs(x).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (x: number): string => '$' + Math.round(x).toLocaleString('es-EC');

/** Pagos hechos con cuentas o tarjetas de terceros, o que pagó otra persona. */
export function pagosDeTerceros(deudas: DeudaMotor[], n: Nombres) {
  return deudas
    .flatMap((d) => d.movs)
    .filter((m) => {
      const o = m.origen;
      if (!o) return false;
      return !!o.tercero || (!!o.cuentaId && !!n.cuentas.get(o.cuentaId)?.tercero) || (!!o.tarjetaId && !!n.tarjetas.get(o.tarjetaId)?.tercero);
    });
}

export interface Capacidad {
  ing: number;
  fijas: number;
  lim: number;
  margen: number;
  /** Crédito equivalente a 24 meses al 15% anual que cabe en el margen. */
  prestamo: number;
  promedioIngreso3: number;
  promedioPagos3: number;
  flujo: number;
  promedio6: number;
  extraAnio: number;
  terceros: { monto: number; cantidad: number };
  recomendaciones: Recomendacion[];
}

export function calcularCapacidad(
  ing: number,
  ingresos: IngresoFila[],
  deudas: DeudaMotor[],
  n: Nombres,
  hoy: string,
): Capacidad {
  const per = hoy.slice(0, 7);
  const activas = deudas.filter((d) => !cerrada(d));
  const fijas = r2(suma(activas, (d) => cuotaFijaMensual(d, hoy)));
  const lim = r2(ing * LIMITE_ENDEUDAMIENTO);
  const margen = r2(lim - fijas);
  const ti = 0.15 / 12;
  const prestamo = margen > 0 ? r2((margen * (1 - Math.pow(1 + ti, -24))) / ti) : 0;

  const ult3 = [1, 2, 3].map((j) => periodoSiguiente(per, -j));
  const ult6 = [0, 1, 2, 3, 4, 5].map((j) => periodoSiguiente(per, -j));
  const promedioIngreso3 = r2(suma(ult3, (m) => ingresoMes(ingresos, m)) / 3);
  const promedioPagos3 = r2(suma(ult3, (m) => pagadoEnMes(deudas, m)) / 3);
  const flujo = r2(promedioIngreso3 - promedioPagos3);
  const promedio6 = r2(suma(ult6, (m) => ingresoMes(ingresos, m)) / 6);
  const anio = per.slice(0, 4);
  const extraAnio = r2(
    suma(
      ingresos.filter((x) => x.periodicidad !== 'mensual' && ['extra', 'activo'].includes(x.clase) && x.fecha.startsWith(anio)),
      (x) => Number(x.monto),
    ),
  );
  const total6 = suma(ult6, (m) => ingresoMes(ingresos, m));
  const variable6 = suma(
    ingresos.filter((x) => x.periodicidad !== 'mensual' && x.clase === 'variable' && ult6.includes(x.fecha.slice(0, 7))),
    (x) => Number(x.monto),
  );
  const variablePct = total6 ? (variable6 / total6) * 100 : 0;
  const prestamos = suma(ingresos.filter((x) => x.clase === 'prestamo'), (x) => Number(x.monto));
  const sueldo = ingresos.find((x) => x.fuente === 'sueldo' && x.periodicidad === 'mensual' && (!x.hasta || x.hasta >= per));
  const creditos = activas
    .filter((d) => esPrestamoDetallado(d) && cuotasPagadasSeguidas(d) < d.amort!.rows.length - 1)
    .sort((a, b) => tasaDe(b) - tasaDe(a));
  const ter = pagosDeTerceros(deudas, n);

  const recs: Recomendacion[] = [];
  if (ing) {
    recs.push(
      margen >= 0
        ? {
            tono: 'ok',
            texto: `Puedes destinar hasta **${fmt(margen)}** al mes a nuevas cuotas sin pasar del 35% de tu ingreso fijo (≈ un crédito de **${fmt0(prestamo)}** a 24 meses al 15% anual). Que puedas no significa que debas.`,
          }
        : {
            tono: 'bad',
            texto: `Tus cuotas fijas superan en **${fmt(-margen)}** el 35% de tu ingreso fijo. No tomes nuevas deudas y prioriza abonar a la más cara.`,
          },
    );
    if (promedioIngreso3 > 0) {
      recs.push({
        tono: flujo < 0 ? 'bad' : 'info',
        texto: `En los últimos 3 meses recibiste en promedio **${fmt(promedioIngreso3)}** y pagaste deudas por **${fmt(promedioPagos3)}**: te quedaron ≈**${fmt(flujo)}** al mes para gastos de vida y ahorro.`,
      });
    }
  } else {
    recs.push({ tono: 'warn', texto: 'Registra tu sueldo u otros ingresos fijos para calcular cuánto puedes destinar a deudas.' });
  }
  if (extraAnio > 0 && creditos.length) {
    const L = creditos[0];
    const abono = r2(Math.min(extraAnio * 0.5, infoDeuda(L, hoy).saldoCapital - 1));
    if (abono > 0) {
      const s = simularAbono(L.amort!.rows, tasaDe(L), cuotasPagadasSeguidas(L), abono, 'plazo');
      recs.push({
        tono: 'ok',
        texto: `Este año recibiste **${fmt(extraAnio)}** en ingresos extraordinarios. Si destinas la mitad (${fmt(abono)}) a abonar ${L.alias || L.acreedorNombre}, ahorras ≈**${fmt(s.ahorro)}** en intereses y terminas ${s.mesesMenos} cuota(s) antes.`,
      });
    }
  }
  if (sueldo && Number(per.slice(5)) >= 9) {
    recs.push({
      tono: 'info',
      texto: `En diciembre recibirás tu **décimo tercer sueldo** (aproximadamente un sueldo si trabajaste todo el año, ≈${fmt(Number(sueldo.monto))}). Decide desde ahora: abono a capital, fondo de emergencia o los gastos de fin de año.`,
    });
  }
  if (fijas > 0) {
    recs.push({
      tono: 'info',
      texto: `Meta de fondo de emergencia: **${fmt(fijas * 3)}** (3 meses de cuotas fijas). Te protege si un mes falta el ingreso.`,
    });
  }
  if (ter.length) {
    recs.push({
      tono: 'warn',
      texto: `**${fmt(suma(ter, (m) => m.monto))}** de tus pagos (${ter.length}) salieron de cuentas o tarjetas de terceros. Regístralo siempre: así sabes cuánto dependes de otros y cuánto les debes.`,
    });
  }
  if (variablePct > 40) {
    recs.push({ tono: 'warn', texto: `El ${Math.round(variablePct)}% de tus ingresos es variable: calcula tus cuotas solo con el ingreso fijo.` });
  }
  if (prestamos > 0) {
    recs.push({ tono: 'warn', texto: `Registraste ${fmt(prestamos)} de dinero prestado: no es ingreso. Inclúyelo también como deuda.` });
  }

  return {
    ing,
    fijas,
    lim,
    margen,
    prestamo,
    promedioIngreso3,
    promedioPagos3,
    flujo,
    promedio6,
    extraAnio,
    terceros: { monto: r2(suma(ter, (m) => m.monto)), cantidad: ter.length },
    recomendaciones: recs,
  };
}

/* ------------------------------------------------------------ salidas */

function ingresoApi(i: IngresoFila, n: Nombres) {
  return {
    id: i.id,
    fuente: i.fuente,
    fuenteNombre: i.fuente_nombre,
    clase: i.clase,
    claseEtiqueta: ETIQUETA_CLASE[i.clase],
    descripcion: i.descripcion,
    monto: Number(i.monto),
    fecha: i.fecha,
    periodicidad: i.periodicidad,
    hasta: i.hasta,
    cuentaId: i.cuenta_id,
    cuentaNombre: i.cuenta_id ? n.cuentas.get(i.cuenta_id)?.nombre || null : null,
  };
}

export async function fuentesIngreso() {
  const fuentes = await listarFuentes();
  return (Object.keys(ETIQUETA_CLASE) as ClaseIngreso[]).map((clase) => ({
    clase,
    etiqueta: ETIQUETA_CLASE[clase],
    fuentes: fuentes.filter((f) => f.clase === clase).map((f) => ({ codigo: f.codigo, nombre: f.nombre })),
  }));
}

/** Pantalla completa: ingresos, totales, capacidad y flujo de 12 meses. */
export async function resumenIngresos(usuarioId: number) {
  const hoy = hoyISO();
  const per = hoy.slice(0, 7);
  const [ingresos, deudas, n] = await Promise.all([
    listarIngresosPorUsuario(usuarioId),
    cargarCartera(usuarioId),
    cargarNombres(usuarioId),
  ]);
  const ing = await ingresoBase(usuarioId, ingresos, hoy);
  const cap = calcularCapacidad(ing, ingresos, deudas, n, hoy);

  // Flujo: 6 meses reales y 6 proyectados (ingresos vs. pagos de deudas).
  const meses = Array.from({ length: 12 }, (_, j) => periodoSiguiente(per, j - 5));
  const pr = proyeccion(deudas, hoy, 7);
  const proyectado = (m: string) => {
    const i = pr.meses.indexOf(m);
    return i < 0 ? 0 : r2(suma(pr.series, (s) => s.v[i]));
  };
  const flujo = meses.map((m) => ({
    mes: m,
    futuro: m > per,
    ingresos: ingresoMes(ingresos, m),
    pagos: m < per ? pagadoEnMes(deudas, m) : m === per ? r2(pagadoEnMes(deudas, m) + proyectado(m)) : proyectado(m),
  }));

  return {
    hoy,
    ingresos: ingresos.map((i) => ingresoApi(i, n)),
    capacidad: cap,
    flujo,
  };
}

/* ------------------------------------------------------------- CRUD */

export interface IngresoInput {
  fuente: string;
  monto: number;
  fecha: string | Date;
  periodicidad: 'mensual' | 'unico';
  hasta?: string | null;
  cuentaId?: number | null;
  descripcion?: string | null;
}

const aFecha = (v: string | Date): string => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10));

async function validar(usuarioId: number, e: IngresoInput): Promise<IngresoDb> {
  if (!(await fuenteExiste(e.fuente))) throw new HttpError(400, 'Fuente de ingreso no válida');
  const fecha = aFecha(e.fecha);
  const hasta = e.periodicidad === 'mensual' ? e.hasta || null : null;
  if (hasta && hasta < fecha.slice(0, 7)) throw new HttpError(422, '“Hasta” no puede ser antes de la fecha');
  if (e.cuentaId && !(await cuentaEsDelUsuario(usuarioId, e.cuentaId))) throw new HttpError(400, 'La cuenta no existe');
  return {
    fuente: e.fuente,
    descripcion: e.descripcion?.trim() || null,
    monto: r2(e.monto),
    fecha,
    periodicidad: e.periodicidad,
    hasta,
    cuentaId: e.cuentaId || null,
  };
}

export async function registrarIngreso(usuarioId: number, e: IngresoInput) {
  const id = await crearIngreso(usuarioId, await validar(usuarioId, e));
  return ingresoApi((await obtenerIngresoPorId(usuarioId, id))!, await cargarNombres(usuarioId));
}

export async function editarIngreso(usuarioId: number, id: number, e: IngresoInput) {
  if (!(await actualizarIngreso(usuarioId, id, await validar(usuarioId, e)))) throw new HttpError(404, 'Ingreso no encontrado');
  return ingresoApi((await obtenerIngresoPorId(usuarioId, id))!, await cargarNombres(usuarioId));
}

export async function removerIngreso(usuarioId: number, id: number): Promise<void> {
  if (!(await eliminarIngreso(usuarioId, id))) throw new HttpError(404, 'Ingreso no encontrado');
}
