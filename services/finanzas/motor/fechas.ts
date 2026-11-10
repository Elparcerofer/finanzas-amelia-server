/**
 * Fechas del motor de obligaciones. Todo se maneja como texto
 * 'YYYY-MM-DD' (fechas) o 'YYYY-MM' (períodos), igual que el prototipo,
 * para no depender de la zona horaria del servidor.
 */

const ZONA = process.env.FINANZAS_TZ || 'America/Guayaquil';

export const pad = (n: number): string => String(n).padStart(2, '0');

export const r2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

export const suma = <T>(a: T[], f: (x: T) => number): number => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);

/** Hoy en Ecuador (o FINANZAS_TZ), como 'YYYY-MM-DD'. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

export const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const partes = (s: string): number[] => s.slice(0, 10).split('-').map(Number);

/** Suma k meses conservando el día (ajustado a fin de mes). */
export function sumarMeses(s: string, k: number): string {
  const [y, m, d] = partes(s);
  const t = new Date(y, m - 1 + k, 1);
  const ultimo = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(d || 1, ultimo));
  return iso(t);
}

export function sumarDias(s: string, k: number): string {
  const [y, m, d] = partes(s);
  return iso(new Date(y, m - 1, d + k));
}

export function periodoSiguiente(per: string, k = 1): string {
  return sumarMeses(`${per}-01`, k).slice(0, 7);
}

/** Días desde `hoy` hasta `s` (negativo = ya pasó). */
export function diasHasta(s: string, hoy: string): number {
  const [y, m, d] = partes(s);
  const [hy, hm, hd] = partes(hoy);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000);
}

export function difMeses(a: string, b: string): number {
  const [ay, am] = partes(a);
  const [by, bm] = partes(b);
  return (by - ay) * 12 + (bm - am);
}

/** Período (YYYY-MM) al que pertenece un consumo según el día de corte. */
export function periodoDe(fecha: string, corte: number): string {
  const [y, m, d] = partes(fecha);
  let Y = y;
  let M = m;
  if (corte && d > corte) {
    M++;
    if (M > 12) {
      M = 1;
      Y++;
    }
  }
  return `${Y}-${pad(M)}`;
}

/** Fecha de pago del estado de cuenta del período `per`. */
export function vencimientoPeriodo(corte: number, diaPago: number, per: string): string {
  const [y, m] = per.split('-').map(Number);
  const mk = (Y: number, M: number, D: number): string => {
    if (M > 12) {
      M -= 12;
      Y++;
    }
    const ultimo = new Date(Y, M, 0).getDate();
    return `${Y}-${pad(M)}-${pad(Math.min(D, ultimo))}`;
  };
  if (!diaPago) return sumarDias(mk(y, m, corte || 28), 15);
  return corte && diaPago > corte ? mk(y, m, diaPago) : mk(y, m + 1, diaPago);
}

export const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const etiquetaPeriodo = (per: string): string => {
  const [y, m] = per.split('-').map(Number);
  return `${MESES_LARGOS[m - 1]} ${y}`;
};
