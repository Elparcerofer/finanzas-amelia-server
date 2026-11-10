/**
 * Aplica un pago sobre el estado de una deuda (prototipo: aplicarPago).
 *
 * La misma función sirve para:
 *  - registrar un pago nuevo (calcula desglose, descripción, etc.), y
 *  - reconstruir el estado actual reproduciendo los pagos guardados, en
 *    orden. Por eso no hay "fotos" del estado anterior: anular un pago es
 *    marcarlo anulado y volver a reproducir los demás.
 *
 * Para que la reproducción dé siempre lo mismo, los cálculos que
 * dependen de la fecha (período abierto de la tarjeta) usan la fecha del
 * pago, no la de hoy.
 */
import { r2, sumarMeses, suma } from './fechas';
import {
  cuotasPagadasSeguidas,
  esPrestamoDetallado,
  esTarjetaDetallada,
  LEJOS,
  liquidacionTarjeta,
  obligaciones,
  rehacerCola,
} from './obligaciones';
import { Accion, DeudaMotor, Obligacion, Partes } from './tipos';

export interface EntradaPago {
  accion: Accion;
  clave: string | null;
  /** Lo que se aplica a la deuda (sin multas ni cargos). */
  monto: number;
  fecha: string;
  modoAbono?: 'plazo' | 'cuota' | null;
}

export interface ResultadoAplicar {
  monto: number;
  partes: Partes;
  desc: string;
  fechaVence: string | null;
  obligacion: Obligacion | null;
}

export class PagoInvalido extends Error {}

const fmt = (n: number): string =>
  '$' + Math.abs(n).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function concilDe(d: DeudaMotor, per: string) {
  return (d.concil[per] = d.concil[per] || { pagado: 0, fechaPago: null });
}

export function buscarObligacion(d: DeudaMotor, clave: string | null, fecha: string): Obligacion | null {
  if (!clave) return null;
  return obligaciones(d, LEJOS, fecha).find((x) => x.clave === clave) || null;
}

export function aplicarPago(d: DeudaMotor, e: EntradaPago): ResultadoAplicar {
  const it = buscarObligacion(d, e.clave, e.fecha);

  if (e.accion === 'cuota' || e.accion === 'parcial') {
    if (!it) throw new PagoInvalido('Esa cuota ya no está pendiente');
    const monto = r2(e.monto);
    if (esPrestamoDetallado(d)) {
      d.pagosCuota[it.n!] = r2((d.pagosCuota[it.n!] || 0) + monto);
    } else if (esTarjetaDetallada(d)) {
      const c = concilDe(d, it.per!);
      c.pagado = r2(c.pagado + monto);
      c.fechaPago = e.fecha;
    } else {
      const r = d.res!;
      r.abonado = r2((r.abonado || 0) + monto);
      if (r.abonado >= r.valor - 0.009) {
        if (d.tipo === 'tarjeta') {
          d.estado = 'pagada';
        } else {
          if (r.saldo != null) r.saldo = Math.max(0, r2(r.saldo - it.partes.capital));
          if (r.restantes != null) {
            r.restantes = Math.max(0, r.restantes - 1);
            if (r.restantes === 0) d.estado = 'pagada';
          }
          if (!d.estado) r.fecha = sumarMeses(r.fecha, 1);
          r.abonado = 0;
        }
      }
    }
    const f = monto / it.total;
    return {
      monto,
      obligacion: it,
      fechaVence: it.fecha,
      partes: {
        capital: r2(it.partes.capital * f),
        interes: r2(it.partes.interes * f),
        seguro: r2(it.partes.seguro * f),
      },
      desc: it.desc + (e.accion === 'parcial' ? ` · quedan ${fmt(it.monto - monto)}` : ''),
    };
  }

  if (e.accion === 'capital') {
    if (!esPrestamoDetallado(d)) throw new PagoInvalido('El abono a capital solo aplica a créditos con tabla de amortización');
    const k = cuotasPagadasSeguidas(d);
    const R = d.amort!.rows;
    if (k >= R.length) throw new PagoInvalido('La deuda ya no tiene capital pendiente');
    const s0 = r2(R[k].capital + R[k].saldo);
    const modo = e.modoAbono === 'cuota' ? 'cuota' : 'plazo';
    rehacerCola(d, k, r2(s0 - e.monto), modo);
    return {
      monto: r2(e.monto),
      obligacion: null,
      fechaVence: null,
      partes: { capital: r2(e.monto), interes: 0, seguro: 0 },
      desc: `Abono extraordinario · ${modo === 'cuota' ? 'reduce la cuota' : 'reduce el plazo'}`,
    };
  }

  // Liquidación (liq_capital / liq_total).
  let monto = r2(e.monto);
  if (esTarjetaDetallada(d)) {
    const lc = liquidacionTarjeta(d, e.accion, e.fecha);
    for (const x of lc.prev) {
      const c = concilDe(d, x.per!);
      c.pagado = r2(c.pagado + x.monto);
      c.fechaPago = e.fecha;
    }
    for (const f of lc.fut) {
      f.c.liqPer = lc.op;
      f.c.liqMonto = f.monto;
    }
    if (lc.fut.length) {
      const c = concilDe(d, lc.op);
      c.pagado = r2(c.pagado + suma(lc.fut, (f) => f.monto));
      c.fechaPago = e.fecha;
    }
    monto = lc.monto;
  } else if (esPrestamoDetallado(d)) {
    for (const r of d.amort!.rows) {
      if (!r.liq && r.cuota - (d.pagosCuota[r.n] || 0) > 0.009) r.liq = true;
    }
    d.estado = 'liquidada';
  } else {
    d.estado = 'liquidada';
    if (d.res) {
      if (d.res.saldo != null) d.res.saldo = 0;
      if (d.res.restantes != null) d.res.restantes = 0;
    }
  }
  d.liq = { fecha: e.fecha, tipo: e.accion, monto };
  return {
    monto,
    obligacion: null,
    fechaVence: null,
    // El desglose de la liquidación lo completa el servicio con los
    // saldos previos (capital pendiente / seguros por pagar).
    partes: { capital: 0, interes: 0, seguro: 0 },
    desc: e.accion === 'liq_capital' ? 'Precancelación pagando el capital pendiente' : 'Pago de todas las cuotas restantes',
  };
}
