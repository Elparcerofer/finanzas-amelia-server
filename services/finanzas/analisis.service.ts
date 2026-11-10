/**
 * Análisis compartido por Inicio y Reportes (prototipo Solvenza:
 * resumenGlobal, catsOfMov, gastoPorCategoria, gastoPorTipo,
 * puntualidad, grupoOf, soloMinimo).
 */
import { Nombres } from './cartera.service';
import { diasHasta, periodoSiguiente, r2, suma } from './motor/fechas';
import {
  cerrada,
  cuotaFijaMensual,
  esTarjetaDetallada,
  infoDeuda,
  itemsPeriodo,
  pendientes,
} from './motor/obligaciones';
import { DeudaMotor, InfoDeuda, Movimiento, Obligacion, TarjetaMotor } from './motor/tipos';

/* -------------------------------------------------- grupos de acreedor */

export type GrupoDeuda = 'Tarjetas de crédito' | 'Bancos (préstamos)' | 'Cooperativas' | 'Casas comerciales' | 'Suscripciones';

export const COLOR_GRUPO: Record<GrupoDeuda, string> = {
  'Tarjetas de crédito': '#3f52b5',
  'Bancos (préstamos)': '#e0900b',
  Cooperativas: '#0e7d72',
  'Casas comerciales': '#ef6461',
  Suscripciones: '#8a63c8',
};

export function grupoDe(d: DeudaMotor): GrupoDeuda {
  if (d.tipo === 'suscripcion') return 'Suscripciones';
  if (d.tipo === 'tarjeta') return 'Tarjetas de crédito';
  if (d.fuente === 'empresas') return 'Casas comerciales';
  return (d.acreedorSubtipo || '').toLowerCase().includes('cooperativa') ? 'Cooperativas' : 'Bancos (préstamos)';
}

/* --------------------------------------------- categorías de los pagos */

/** Categoría por defecto según el tipo de crédito (prototipo: TIPO_CAT). */
const CATEGORIA_POR_TIPO: Record<string, string> = {
  hipotecario: 'vivienda',
  vehicular: 'vehiculo',
  suscripcion: 'suscripciones',
  capital: 'trabajo',
  garantia: 'trabajo',
};

/** Id de la categoría automática de la deuda (la elegida o la del tipo de crédito). */
export function categoriaDeDeuda(d: DeudaMotor, n: Nombres): number | null {
  return d.categoriaId || n.porCodigo.get(CATEGORIA_POR_TIPO[d.tipo]) || n.porCodigo.get('sin_categoria') || null;
}

/**
 * Reparte un pago en categorías (prototipo: catsOfMov): intereses, seguros
 * y recargos van a sus categorías del sistema; el capital, según lo elegido
 * en el pago, los consumos de la tarjeta o la categoría de la deuda.
 */
export function categoriasDelPago(d: DeudaMotor, m: Movimiento, n: Nombres): Map<number, number> {
  const out = new Map<number, number>();
  const add = (id: number | null | undefined, v: number) => {
    if (!id || v <= 0.004) return;
    out.set(id, (out.get(id) || 0) + v);
  };
  const p = m.partes;
  add(n.porCodigo.get('intereses'), p.interes);
  add(n.porCodigo.get('seguros'), p.seguro);
  add(n.porCodigo.get('multas'), p.cargos || 0);
  const cap = Math.max(0, m.monto - p.interes - p.seguro - (p.cargos || 0));
  const sinCat = n.porCodigo.get('sin_categoria');

  if (m.cats && Object.keys(m.cats).length) {
    const t = suma(Object.values(m.cats), (x) => x) || 1;
    for (const [k, v] of Object.entries(m.cats)) add(Number(k), (cap * v) / t);
  } else if (esTarjetaDetallada(d) && m.clave?.startsWith('p:')) {
    const pesos = new Map<number, number>();
    for (const x of itemsPeriodo(d, m.clave.slice(2))) {
      const capital = x.cuotaN && !x.liq ? Math.min(x.valor, x.c.monto / (x.c.plazo || 1)) : x.valor;
      const id = x.c.categoriaId || sinCat || 0;
      pesos.set(id, (pesos.get(id) || 0) + capital);
    }
    const tw = suma([...pesos.values()], (x) => x);
    if (tw > 0) for (const [k, v] of pesos) add(k, (cap * v) / tw);
    else add(sinCat, cap);
  } else {
    add(categoriaDeDeuda(d, n), cap);
  }
  return out;
}

/** Lo pagado por categoría desde `desde` (YYYY-MM-DD). */
export function gastoPorCategoria(deudas: DeudaMotor[], n: Nombres, desde: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const d of deudas) {
    for (const m of d.movs) {
      if (m.fecha < desde) continue;
      for (const [k, v] of categoriasDelPago(d, m, n)) out.set(k, (out.get(k) || 0) + v);
    }
  }
  return out;
}

export type TipoGasto = 'Necesidad' | 'Gusto' | 'Ahorro e inversión' | 'Obligación financiera' | 'Sin clasificar';

const TIPO_POR_SUBTIPO: Record<string, TipoGasto> = {
  necesidad: 'Necesidad',
  gusto: 'Gusto',
  ahorroInversion: 'Ahorro e inversión',
  obligacionFinanciera: 'Obligación financiera',
  sinClasificar: 'Sin clasificar',
};

export const COLOR_TIPO: Record<TipoGasto, string> = {
  Necesidad: '#0e7d72',
  Gusto: '#f4a825',
  'Ahorro e inversión': '#3f52b5',
  'Obligación financiera': '#ef6461',
  'Sin clasificar': '#98a1c2',
};

/** Lo pagado por tipo de gasto (regla 50/30/20) en los últimos `meses` meses. */
export function gastoPorTipo(deudas: DeudaMotor[], n: Nombres, hoy: string, meses: number): Record<TipoGasto, number> {
  const desde = `${periodoSiguiente(hoy.slice(0, 7), -(meses - 1))}-01`;
  const t = {} as Record<TipoGasto, number>;
  for (const [id, v] of gastoPorCategoria(deudas, n, desde)) {
    const tipo = TIPO_POR_SUBTIPO[n.categorias.get(id)?.subtipo || ''] || 'Sin clasificar';
    t[tipo] = (t[tipo] || 0) + v;
  }
  return t;
}

/* --------------------------------------------------------- puntualidad */

export interface Puntualidad {
  total: number;
  aTiempo: number;
  tarde: { deuda: DeudaMotor; mov: Movimiento }[];
  pagos: { deuda: DeudaMotor; mov: Movimiento }[];
}

export function puntualidad(deudas: DeudaMotor[]): Puntualidad {
  const pagos = deudas.flatMap((d) =>
    d.movs.filter((m) => m.fechaVence && (m.accion === 'cuota' || m.accion === 'parcial')).map((m) => ({ deuda: d, mov: m })),
  );
  const tarde = pagos.filter((x) => x.mov.fecha > x.mov.fechaVence!);
  return { total: pagos.length, aTiempo: pagos.length - tarde.length, tarde, pagos };
}

/** Meses y los intereses de pagar solo el mínimo (prototipo: soloMinimo). */
export function soloMinimo(saldo: number, pago: number, tasa: number): { meses: number; interes: number } | null {
  const i = (tasa || 16) / 1200;
  let B = saldo;
  let m = 0;
  let int = 0;
  while (B > 0.005 && m < 600) {
    const it = B * i;
    if (pago <= it) return null;
    int += it;
    B = B + it - pago;
    m++;
  }
  return { meses: m, interes: r2(int) };
}

/* --------------------------------------------------- resumen global */

export type Nivel = 'ok' | 'warn' | 'bad';

export interface ResumenGlobal {
  activas: DeudaMotor[];
  infos: { deuda: DeudaMotor; info: InfoDeuda }[];
  grupos: Map<GrupoDeuda, number>;
  total: number;
  pendientes: { deuda: DeudaMotor; it: Obligacion }[];
  vencidos: { deuda: DeudaMotor; it: Obligacion }[];
  ingreso: number;
  fijas: number;
  endeudamiento: number;
  tarjetas: { tarjeta: TarjetaMotor; saldo: number; deudas: DeudaMotor[] }[];
  cupo: number;
  usado: number;
  usoCupo: number;
  interesPendiente: number;
  puntualidad: Puntualidad;
  score: number;
  factores: [Nivel, string][];
}

const pct = (n: number): string => `${n.toLocaleString('es-EC', { maximumFractionDigits: 2 })}%`;

export function resumenGlobal(deudas: DeudaMotor[], ingreso: number, n: Nombres, hoy: string): ResumenGlobal {
  const activas = deudas.filter((d) => !cerrada(d));
  const infos = activas.map((d) => ({ deuda: d, info: infoDeuda(d, hoy) }));
  const grupos = new Map<GrupoDeuda, number>();
  for (const x of infos) grupos.set(grupoDe(x.deuda), (grupos.get(grupoDe(x.deuda)) || 0) + x.info.saldoCapital);
  const total = r2(suma(infos, (x) => x.info.saldoCapital));
  const pend = deudas
    .flatMap((d) => pendientes(d, hoy).map((it) => ({ deuda: d, it })))
    .sort((a, b) => a.it.fecha.localeCompare(b.it.fecha));
  const vencidos = pend.filter((x) => diasHasta(x.it.fecha, hoy) < 0);
  const fijas = r2(suma(activas, (d) => cuotaFijaMensual(d, hoy)));
  const endeudamiento = ingreso ? (fijas / ingreso) * 100 : 0;

  const porTarjeta = new Map<number, { tarjeta: TarjetaMotor; saldo: number; deudas: DeudaMotor[] }>();
  for (const x of infos) {
    const t = x.deuda.tarjeta;
    if (x.deuda.tipo !== 'tarjeta' || !t) continue;
    const r = porTarjeta.get(t.id) || { tarjeta: t, saldo: 0, deudas: [] };
    r.saldo += x.info.saldoCapital;
    r.deudas.push(x.deuda);
    porTarjeta.set(t.id, r);
  }
  const tarjetas = [...porTarjeta.values()];
  const cupo = suma(tarjetas, (x) => x.tarjeta.cupo);
  const usado = suma(tarjetas, (x) => x.saldo);
  const usoCupo = cupo ? (usado / cupo) * 100 : 0;
  const interesPendiente = r2(suma(infos, (x) => x.info.interesPorPagar + x.info.segurosPorPagar));
  const punt = puntualidad(deudas);

  // Semáforo de salud financiera (prototipo: resumenGlobal → score).
  let sc = 100;
  const f: [Nivel, string][] = [];
  const end = r2(endeudamiento);
  if (endeudamiento > 40) {
    sc -= 25;
    f.push(['bad', `Cuotas fijas: ${pct(end)} de tu ingreso`]);
  } else if (endeudamiento > 30) {
    sc -= 12;
    f.push(['warn', `Cuotas fijas: ${pct(end)} de tu ingreso`]);
  } else f.push(['ok', `Cuotas fijas: ${pct(end)} de tu ingreso`]);
  const uso = Math.round(usoCupo);
  if (usoCupo > 70) {
    sc -= 20;
    f.push(['bad', `Uso de cupo: ${pct(uso)}`]);
  } else if (usoCupo > 30) {
    sc -= 10;
    f.push(['warn', `Uso de cupo: ${pct(uso)}`]);
  } else f.push(['ok', `Uso de cupo: ${pct(uso)}`]);
  if (vencidos.length) {
    sc -= Math.min(30, vencidos.length * 10);
    f.push(['bad', `${vencidos.length} pago(s) vencido(s)`]);
  } else f.push(['ok', 'Sin pagos vencidos']);
  if (punt.total) {
    const p = (punt.aTiempo / punt.total) * 100;
    if (p < 75) {
      sc -= 8;
      f.push(['warn', `Pagos a tiempo: ${pct(Math.round(p))}`]);
    } else f.push(['ok', `Pagos a tiempo: ${pct(Math.round(p))}`]);
  }
  const gt = gastoPorTipo(deudas, n, hoy, 3);
  const gustos = ingreso ? ((gt['Gusto'] || 0) / 3 / ingreso) * 100 : 0;
  const financiero = ingreso ? ((gt['Obligación financiera'] || 0) / 3 / ingreso) * 100 : 0;
  if (ingreso && gustos > 0) {
    if (gustos > 30) {
      sc -= 8;
      f.push(['warn', `Gustos: ${pct(Math.round(gustos))} del ingreso`]);
    } else f.push(['ok', `Gustos: ${pct(Math.round(gustos))} del ingreso`]);
  }
  if (ingreso && financiero > 10) {
    sc -= 6;
    f.push(['warn', `Intereses, seguros y multas: ${pct(Math.round(financiero))} del ingreso`]);
  }

  return {
    activas,
    infos,
    grupos,
    total,
    pendientes: pend,
    vencidos,
    ingreso,
    fijas,
    endeudamiento,
    tarjetas,
    cupo,
    usado,
    usoCupo,
    interesPendiente,
    puntualidad: punt,
    score: Math.max(0, Math.min(100, Math.round(sc))),
    factores: f,
  };
}
