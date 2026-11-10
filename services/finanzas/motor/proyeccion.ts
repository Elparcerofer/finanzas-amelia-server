/**
 * Proyección de pagos por mes (prototipo: proyeccion) y pagos
 * registrados por mes. Base de Ingresos, Inicio y Reportes.
 */
import { periodoSiguiente, r2, suma } from './fechas';
import { obligaciones } from './obligaciones';
import { DeudaMotor } from './tipos';

export interface SerieDeuda {
  deuda: DeudaMotor;
  /** Lo comprometido por mes, y su desglose. */
  v: number[];
  cap: number[];
  int: number[];
  seg: number[];
}

export interface Proyeccion {
  meses: string[];
  series: SerieDeuda[];
}

/** Lo comprometido por cada deuda en los próximos n meses (lo vencido cae en el mes actual). */
export function proyeccion(deudas: DeudaMotor[], hoy: string, n = 12): Proyeccion {
  const actual = hoy.slice(0, 7);
  const meses = Array.from({ length: n }, (_, i) => periodoSiguiente(actual, i));
  const hasta = meses[meses.length - 1];
  const series = deudas
    .map((d) => {
      const cero = () => meses.map(() => 0);
      const s: SerieDeuda = { deuda: d, v: cero(), cap: cero(), int: cero(), seg: cero() };
      for (const x of obligaciones(d, hasta, hoy)) {
        const m = x.fecha.slice(0, 7) < actual ? actual : x.fecha.slice(0, 7);
        const i = meses.indexOf(m);
        if (i < 0) continue;
        const f = x.monto / x.total;
        s.v[i] += x.monto;
        s.cap[i] += x.partes.capital * f;
        s.int[i] += x.partes.interes * f;
        s.seg[i] += x.partes.seguro * f;
      }
      return s;
    })
    .filter((s) => suma(s.v, (x) => x) > 0.009);
  return { meses, series };
}

/** Total comprometido del mes i de la proyección. */
export const totalMes = (p: Proyeccion, i: number): number => r2(suma(p.series, (s) => s.v[i]));

/** Total pagado (registrado) en el mes 'YYYY-MM'. */
export function pagadoEnMes(deudas: DeudaMotor[], per: string): number {
  return r2(suma(deudas.flatMap((d) => d.movs).filter((m) => m.fecha.slice(0, 7) === per), (m) => m.monto));
}
