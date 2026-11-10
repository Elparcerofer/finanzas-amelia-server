/**
 * Obligaciones (lo que hay que pagar), saldos y liquidación de una deuda.
 * Traducción de las funciones del prototipo Solvenza: obligaciones,
 * pendientes, infoDeuda, itemsPeriodo, tarjetaLiqCalc, simAbono y
 * rebuildTail. Funciones puras: reciben el estado y la fecha de hoy.
 */
import {
  diasHasta,
  difMeses,
  etiquetaPeriodo,
  MESES_LARGOS,
  periodoDe,
  periodoSiguiente,
  r2,
  sumarMeses,
  suma,
  vencimientoPeriodo,
} from './fechas';
import { ConsumoMotor, CuotaMotor, DeudaMotor, InfoDeuda, Obligacion, Partes } from './tipos';

/** Horizonte "sin límite" (50 años). */
export const LEJOS = '2999-12';

export const esPrestamoDetallado = (d: DeudaMotor): boolean => d.modo === 'detallada' && d.tipo !== 'tarjeta' && !!d.amort;
export const esTarjetaDetallada = (d: DeudaMotor): boolean => d.modo === 'detallada' && d.tipo === 'tarjeta';
export const cerrada = (d: DeudaMotor): boolean => d.estado === 'liquidada' || d.estado === 'pagada';

const corteDe = (d: DeudaMotor): number => d.tarjeta?.corte || 0;
const tasaMensualTarjeta = (d: DeudaMotor): number => (d.tarjeta?.tasa || 0) / 1200;

/** Período de la tarjeta que está abierto (se factura en el próximo corte). */
export const periodoAbierto = (d: DeudaMotor, hoy: string): string => periodoDe(hoy, corteDe(d));

export function tasaDe(d: DeudaMotor): number {
  if (esPrestamoDetallado(d)) return d.amort!.params.tasa || 0;
  if (d.tipo === 'tarjeta') return d.tarjeta?.tasa || 0;
  return d.res?.tasa || 0;
}

/* ------------------------------------------------------------ tarjeta */

export function cuotaDiferido(c: ConsumoMotor, i: number): number {
  const n = c.plazo || 1;
  return r2(c.mod === 'dif_con' && i > 0 ? (c.monto * i) / (1 - Math.pow(1 + i, -n)) : c.monto / n);
}

export interface ItemPeriodo {
  key: string;
  c: ConsumoMotor;
  /** '3/12', 'precancelación' o null si es corriente. */
  cuotaN: string | null;
  valor: number;
  liq?: boolean;
}

/** Lo que factura la tarjeta en el período `per`: corrientes + cuotas de diferidos. */
export function itemsPeriodo(d: DeudaMotor, per: string): ItemPeriodo[] {
  const corte = corteDe(d);
  const i = tasaMensualTarjeta(d);
  const out: ItemPeriodo[] = [];
  for (const c of d.consumos) {
    const p0 = periodoDe(c.fecha, corte);
    if (c.mod === 'corriente') {
      if (p0 === per) out.push({ key: String(c.id), c, cuotaN: null, valor: c.monto });
      continue;
    }
    const n = c.plazo || 1;
    // Meses de gracia: la primera cuota se factura `gracia` períodos después.
    const k = difMeses(p0, per) + 1 - (c.gracia || 0);
    if (c.liqPer && per > c.liqPer) continue;
    if (k >= 1 && k <= n) {
      out.push({ key: `${c.id}#${k}`, c, cuotaN: `${k}/${n}`, valor: cuotaDiferido(c, i) });
    }
    if (c.liqPer && per === c.liqPer && (c.liqMonto || 0) > 0) {
      out.push({ key: `${c.id}#liq`, c, cuotaN: 'precancelación', valor: c.liqMonto!, liq: true });
    }
  }
  return out.sort((a, b) => a.c.fecha.localeCompare(b.c.fecha));
}

function partesItems(items: ItemPeriodo[]): Partes {
  let cap = 0;
  let int = 0;
  for (const x of items) {
    if (!x.cuotaN || x.liq) {
      cap += x.valor;
    } else {
      const c = x.c.monto / (x.c.plazo || 1);
      cap += Math.min(c, x.valor);
      int += Math.max(0, x.valor - c);
    }
  }
  return { capital: r2(cap), interes: r2(int), seguro: 0 };
}

/* ------------------------------------------------------- obligaciones */

/** Todas las obligaciones (vencidas o futuras) de la deuda hasta el mes `hasta` (YYYY-MM). */
export function obligaciones(d: DeudaMotor, hasta: string, hoy: string): Obligacion[] {
  if (cerrada(d)) return [];
  const out: Obligacion[] = [];

  if (esPrestamoDetallado(d)) {
    const R = d.amort!.rows;
    for (const r of R) {
      if (r.liq) continue;
      const pg = d.pagosCuota[r.n] || 0;
      const pend = r2(r.cuota - pg);
      if (pend <= 0.009 || r.fecha.slice(0, 7) > hasta) continue;
      out.push({
        deudaId: d.id,
        clave: `c:${r.n}`,
        n: r.n,
        fecha: r.fecha,
        total: r.cuota,
        pagado: pg,
        monto: pend,
        desc: `Cuota ${r.n}/${R.length}`,
        partes: { capital: r.capital, interes: r.interes, seguro: r.seguro },
      });
    }
  } else if (esTarjetaDetallada(d)) {
    const t = d.tarjeta;
    if (!d.consumos.length || !t) return out;
    const corte = t.corte || 0;
    let per = d.consumos.map((c) => periodoDe(c.fecha, corte)).sort()[0];
    const op = periodoAbierto(d, hoy);
    for (let g = 0; g < 600; g++) {
      const vence = vencimientoPeriodo(corte, t.diaPago, per);
      if (vence.slice(0, 7) > hasta) break;
      if (vence >= d.creado) {
        const items = itemsPeriodo(d, per);
        const total = r2(suma(items, (x) => x.valor));
        if (total > 0.009) {
          const pg = d.concil[per]?.pagado || 0;
          const pend = r2(total - pg);
          if (pend > 0.009) {
            const etq = etiquetaPeriodo(per);
            out.push({
              deudaId: d.id,
              clave: `p:${per}`,
              per,
              fecha: vence,
              total,
              pagado: pg,
              monto: pend,
              partes: partesItems(items),
              futura: per > op,
              desc:
                per < op
                  ? `Estado de cuenta de ${etq}`
                  : per === op
                    ? `Período en curso (${etq})`
                    : `Cuotas diferidas de ${etq}`,
            });
          }
        }
      }
      per = periodoSiguiente(per);
    }
  } else {
    const r = d.res;
    if (!r || !(r.valor > 0) || !r.fecha) return out;
    const ab = r.abonado || 0;
    const rest =
      d.tipo === 'tarjeta' ? 1 : r.restantes != null ? Math.max(1, r.restantes) : d.tipo === 'suscripcion' ? 12 : 1;
    let saldo = r.saldo;
    const i = (r.tasa || 0) / 1200;
    for (let k = 0; k < rest; k++) {
      const f = sumarMeses(r.fecha, k);
      if (f.slice(0, 7) > hasta) break;
      const total = r.valor;
      let int = 0;
      if (saldo != null && i > 0) {
        int = r2(saldo * i);
        saldo = Math.max(0, saldo - (total - int));
      }
      out.push({
        deudaId: d.id,
        clave: k ? `r+${k}` : 'r',
        fecha: f,
        total,
        pagado: k ? 0 : ab,
        monto: r2(total - (k ? 0 : ab)),
        partes: { capital: r2(total - int), interes: int, seguro: 0 },
        desc:
          d.tipo === 'tarjeta'
            ? 'Pago del estado de cuenta'
            : d.tipo === 'suscripcion'
              ? `Cobro de ${MESES_LARGOS[Number(f.slice(5, 7)) - 1]}`
              : `Cuota${r.restantes != null ? ` (quedan ${rest - k})` : ''}`,
      });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Lo que hay que pagar ya: todo lo vencido + el próximo vencimiento. */
export function pendientes(d: DeudaMotor, hoy: string): Obligacion[] {
  const all = obligaciones(d, LEJOS, hoy);
  if (d.modo === 'resumida') return all.slice(0, 1);
  const out: Obligacion[] = [];
  for (const x of all) {
    out.push(x);
    if (diasHasta(x.fecha, hoy) >= 0) break;
  }
  return out;
}

/** Cuántas cuotas de la tabla ya están completamente pagadas (desde la primera). */
export function cuotasPagadasSeguidas(d: DeudaMotor): number {
  const R = d.amort!.rows;
  let k = 0;
  while (k < R.length && (R[k].liq || (d.pagosCuota[R[k].n] || 0) >= R[k].cuota - 0.01)) k++;
  return k;
}

/* ------------------------------------------------------- liquidación */

export interface LiqTarjeta {
  op: string;
  fut: { c: ConsumoMotor; monto: number; capital: number; total: number }[];
  prev: Obligacion[];
  monto: number;
  capital: number;
  total: number;
}

/** Liquidación de tarjeta detallada: estados pendientes + capital (o cuotas) de diferidos futuros. */
export function liquidacionTarjeta(d: DeudaMotor, accion: 'liq_capital' | 'liq_total', hoy: string): LiqTarjeta {
  const t = d.tarjeta!;
  const corte = t.corte || 0;
  const i = tasaMensualTarjeta(d);
  const op = periodoAbierto(d, hoy);
  const fut: LiqTarjeta['fut'] = [];
  for (const c of d.consumos) {
    if (c.mod === 'corriente' || c.liqPer) continue;
    const n = c.plazo || 1;
    const p0 = periodoDe(c.fecha, corte);
    const k = Math.max(0, difMeses(p0, op) + 1 - (c.gracia || 0));
    if (k >= n) continue;
    const futN = n - k;
    const cu = cuotaDiferido(c, i);
    const cap =
      c.mod === 'dif_con' && i > 0
        ? (c.monto * (Math.pow(1 + i, n) - Math.pow(1 + i, k))) / (Math.pow(1 + i, n) - 1)
        : (c.monto * futN) / n;
    fut.push({ c, monto: r2(accion === 'liq_total' ? cu * futN : cap), capital: r2(cap), total: r2(cu * futN) });
  }
  const prev = obligaciones(d, vencimientoPeriodo(corte, t.diaPago, op).slice(0, 7), hoy).filter(
    (x) => (x.per || '') <= op,
  );
  return {
    op,
    fut,
    prev,
    monto: r2(suma(prev, (x) => x.monto) + suma(fut, (x) => x.monto)),
    capital: r2(suma(prev, (x) => (x.partes.capital * x.monto) / x.total) + suma(fut, (x) => x.capital)),
    total: r2(suma(prev, (x) => x.monto) + suma(fut, (x) => x.total)),
  };
}

/* ------------------------------------------------- saldos de la deuda */

export function infoDeuda(d: DeudaMotor, hoy: string): InfoDeuda {
  const all = obligaciones(d, LEJOS, hoy);
  const o: InfoDeuda = {
    saldoCapital: 0,
    totalPorPagar: r2(suma(all, (x) => x.monto)),
    interesPorPagar: 0,
    segurosPorPagar: 0,
    cuotasRest: all.length,
    cuotasTot: null,
    fin: all.length ? all[all.length - 1].fecha : null,
    tasa: tasaDe(d) || null,
    liqCapital: 0,
    liqDet: [],
    vencido: r2(suma(all.filter((x) => diasHasta(x.fecha, hoy) < 0), (x) => x.monto)),
  };
  if (cerrada(d)) {
    o.totalPorPagar = 0;
    o.cuotasRest = 0;
    return o;
  }

  if (esPrestamoDetallado(d)) {
    const R = d.amort!.rows;
    const p = d.amort!.params;
    o.cuotasTot = R.length;
    const pagadoDe = (r: CuotaMotor) => d.pagosCuota[r.n] || 0;
    const fr = (r: CuotaMotor) => (r.cuota - pagadoDe(r)) / r.cuota;
    const pend = R.filter((r) => !r.liq && r.cuota - pagadoDe(r) > 0.009);
    o.interesPorPagar = r2(suma(pend, (r) => r.interes * fr(r)));
    o.segurosPorPagar = r2(suma(pend, (r) => r.seguro * fr(r)));
    if (!pend.length) return o;
    const first = pend[0];
    const base = r2(first.capital + first.saldo);
    o.saldoCapital = r2(base - first.capital * (1 - fr(first)));
    const venc = pend.filter((r) => diasHasta(r.fecha, hoy) < 0);
    const fut = pend.filter((r) => diasHasta(r.fecha, hoy) >= 0);
    const vencMonto = r2(suma(venc, (r) => r.cuota - pagadoDe(r)));
    const capRest = venc.length ? venc[venc.length - 1].saldo : o.saldoCapital;
    let intDev = 0;
    let segP = 0;
    let dias = 0;
    if (fut.length && capRest > 0) {
      const f0 = fut[0];
      const prev = f0.n === 1 ? p.inicio || sumarMeses(f0.fecha, -1) : R[f0.n - 2].fecha;
      dias = Math.max(0, -diasHasta(prev, hoy));
      intDev = r2((capRest * (o.tasa || 0)) / 36000 * dias);
      segP = r2(f0.seguro * Math.min(1, dias / 30));
    }
    o.liqCapital = r2(vencMonto + capRest + intDev + segP);
    o.liqDet = [
      ...(venc.length ? ([[`Cuotas vencidas (${venc.length})`, vencMonto]] as [string, number][]) : []),
      ['Capital pendiente', capRest],
      [`Interés de ${dias} días transcurridos`, intDev],
      ...(segP ? ([['Seguros proporcionales', segP]] as [string, number][]) : []),
    ];
  } else if (esTarjetaDetallada(d)) {
    if (!d.tarjeta) return o;
    const lc = liquidacionTarjeta(d, 'liq_capital', hoy);
    o.saldoCapital = lc.capital;
    o.liqCapital = lc.monto;
    o.totalPorPagar = lc.total;
    o.interesPorPagar = r2(Math.max(0, lc.total - lc.capital));
    o.cuotasRest = all.length;
    o.liqDet = [
      ['Pendiente de estados de cuenta', r2(suma(lc.prev, (x) => x.monto))],
      ['Capital de diferidos por vencer', r2(suma(lc.fut, (x) => x.capital))],
    ];
  } else if (d.res) {
    const r = d.res;
    const ab = r.abonado || 0;
    if (d.tipo === 'tarjeta') {
      o.saldoCapital = r2(r.valor - ab);
      o.liqCapital = o.saldoCapital;
      o.liqDet = [['Saldo del estado de cuenta', o.saldoCapital]];
    } else if (d.tipo === 'suscripcion') {
      const cur = all[0] ? all[0].monto : 0;
      if (r.restantes != null) {
        o.saldoCapital = o.totalPorPagar;
        o.cuotasRest = r.restantes;
      } else {
        o.saldoCapital = r2(cur);
        o.totalPorPagar = r2(cur);
        o.cuotasRest = 'Indefinida';
        o.fin = null;
      }
      o.liqCapital = o.totalPorPagar;
      o.liqDet = [['Pendiente', o.totalPorPagar]];
    } else {
      o.cuotasRest = r.restantes != null ? r.restantes : all.length;
      if (r.saldo != null && r.saldo > 0) {
        o.saldoCapital = r2(r.saldo - ab);
        o.liqCapital = o.saldoCapital;
        o.liqDet = [['Saldo pendiente informado', o.saldoCapital]];
        o.interesPorPagar = Math.max(0, r2(o.totalPorPagar - o.saldoCapital));
      } else {
        o.saldoCapital = o.totalPorPagar;
        o.liqCapital = o.totalPorPagar;
        o.liqDet = [['Total de cuotas restantes', o.totalPorPagar]];
      }
    }
  }
  return o;
}

/* --------------------------------------- abono extraordinario a capital */

/** true si la tabla es de cuota fija (francés) y no de capital fijo (alemán). */
export function esCuotaFija(rows: CuotaMotor[]): boolean {
  if (rows.length < 3) return true;
  const a = rows[0].capital + rows[0].interes;
  const b = rows[rows.length - 2].capital + rows[rows.length - 2].interes;
  return Math.abs(a - b) / a < 0.02;
}

export interface SimulacionAbono {
  /** El abono cubre todo el saldo. */
  liquida: boolean;
  /** Cuotas que quedarían. */
  meses: number;
  ahorro: number;
  mesesMenos: number;
  nuevaCuota: number;
  cuotaActual: number;
}

export function simularAbono(rows: CuotaMotor[], tasa: number, k: number, abono: number, modo: 'plazo' | 'cuota'): SimulacionAbono {
  k = Math.max(0, Math.min(k, rows.length - 1));
  const rest = rows.slice(k);
  const nR = rest.length;
  const saldo0 = r2(rows[k].capital + rows[k].saldo);
  let i = (tasa || 0) / 1200;
  if (!(i > 0)) i = saldo0 > 0 ? rest[0].interes / saldo0 : 0;
  const intOrig = suma(rest, (r) => r.interes);
  const base = rest[0];
  const cuotaActual = base.capital + base.interes;
  let s = saldo0 - abono;
  if (s <= 0.005) return { liquida: true, meses: 0, ahorro: r2(intOrig), mesesMenos: nR, nuevaCuota: 0, cuotaActual: r2(cuotaActual) };
  const fija = esCuotaFija(rows);
  let intNew = 0;
  let m = 0;
  let nuevaCuota = cuotaActual;
  if (modo === 'plazo') {
    if (fija) {
      while (s > 0.005 && m < 1200) {
        const it = s * i;
        let cp = cuotaActual - it;
        if (cp <= 0) break;
        if (cp > s) cp = s;
        s -= cp;
        intNew += it;
        m++;
      }
    } else {
      while (s > 0.005 && m < 1200) {
        const it = s * i;
        s -= Math.min(base.capital, s);
        intNew += it;
        m++;
      }
    }
  } else {
    m = nR;
    if (fija) {
      nuevaCuota = i > 0 ? (s * i) / (1 - Math.pow(1 + i, -nR)) : s / nR;
      intNew = nuevaCuota * nR - s;
    } else {
      const cap = s / nR;
      intNew = i * (s * nR - (cap * nR * (nR - 1)) / 2);
      nuevaCuota = cap + s * i;
    }
  }
  return { liquida: false, meses: m, ahorro: r2(intOrig - intNew), mesesMenos: nR - m, nuevaCuota: r2(nuevaCuota), cuotaActual: r2(cuotaActual) };
}

/** Rehace la tabla desde la cuota k con el nuevo saldo (abono a capital). */
export function rehacerCola(d: DeudaMotor, k: number, nuevoSaldo: number, modo: 'plazo' | 'cuota'): void {
  const R = d.amort!.rows;
  const p = d.amort!.params;
  const fija = esCuotaFija(R);
  const R0 = R[0].fecha;
  const base = R[k];
  const nR = R.length - k;
  const s0 = r2(base.capital + base.saldo);
  let i = (p.tasa || 0) / 1200;
  if (!(i > 0)) i = s0 > 0 ? base.interes / s0 : 0;
  const seguroDe = (s: number) => (p.desgTipo === 'porcentaje' || p.desgTipo === 'pct' ? (s * (p.desgVal || 0)) / 100 + (p.otrosSeg || 0) : base.seguro);
  const fila = (n: number, cp: number, it: number, sg: number, s: number): CuotaMotor => ({
    n,
    fecha: sumarMeses(R0, n - 1),
    capital: r2(cp),
    interes: r2(it),
    seguro: r2(sg),
    cuota: r2(cp + it + sg),
    saldo: r2(s),
  });
  let s = nuevoSaldo;
  let n = k;
  const out: CuotaMotor[] = [];
  if (modo === 'cuota') {
    const c = fija ? (i > 0 ? (s * i) / (1 - Math.pow(1 + i, -nR)) : s / nR) : 0;
    const cap = s / nR;
    for (let j = 0; j < nR; j++) {
      const it = s * i;
      const sg = seguroDe(s);
      let cp = fija ? c - it : cap;
      if (j === nR - 1 || cp > s) cp = s;
      s -= cp;
      if (s < 0.005) s = 0;
      n++;
      out.push(fila(n, cp, it, sg, s));
    }
  } else {
    const c = base.capital + base.interes;
    let j = 0;
    while (s > 0.005 && j < 1200) {
      const it = s * i;
      const sg = seguroDe(s);
      let cp = fija ? c - it : base.capital;
      if (cp > s) cp = s;
      if (cp <= 0) break;
      s -= cp;
      if (s < 0.005) s = 0;
      n++;
      j++;
      out.push(fila(n, cp, it, sg, s));
    }
  }
  d.amort!.rows = R.slice(0, k).concat(out);
  for (const x of Object.keys(d.pagosCuota)) {
    if (Number(x) > d.amort!.rows.length) delete d.pagosCuota[Number(x)];
  }
}

/* ---------------------------------------------------------- utilidades */

/** Interés de mora estimado de una obligación vencida (referencial). */
export function moraEstimada(d: DeudaMotor, it: Obligacion, hoy: string): number {
  const tasa = tasaDe(d) || 16;
  const dias = Math.max(0, -diasHasta(it.fecha, hoy));
  const cap = it.partes.capital * (it.monto / it.total);
  return r2((cap * tasa * 1.1) / 36000 * dias);
}

/** Cuota fija mensual que compromete la deuda (para endeudamiento). */
export function cuotaFijaMensual(d: DeudaMotor, hoy: string): number {
  if (cerrada(d)) return 0;
  const mesActual = hoy.slice(0, 7);
  if (esPrestamoDetallado(d)) {
    const r = d.amort!.rows.find((x) => !x.liq && x.fecha.slice(0, 7) >= mesActual);
    return r ? r.cuota : 0;
  }
  if (esTarjetaDetallada(d)) {
    return suma(itemsPeriodo(d, periodoAbierto(d, hoy)).filter((x) => x.cuotaN && !x.liq), (x) => x.valor);
  }
  if (d.tipo === 'tarjeta') return 0;
  return d.res?.valor || 0;
}
