/**
 * "Reportes y análisis" (prototipo Solvenza: renderAna + insights):
 * indicadores, lecciones con los datos del usuario y los datos de cada
 * gráfico. También alimenta las recomendaciones del asesor.
 */
import { listarIngresosPorUsuario } from '../../models/finanzas/ingreso.model';
import {
  COLOR_GRUPO,
  COLOR_TIPO,
  gastoPorCategoria,
  gastoPorTipo,
  ResumenGlobal,
  resumenGlobal,
  soloMinimo,
  TipoGasto,
} from './analisis.service';
import { cargarCartera, cargarNombres, deudaRef, DeudaRefApi, Nombres, resumenCostos } from './cartera.service';
import { calcularCapacidad, ingresoBase } from './ingresos.service';
import { hoyISO, MESES_LARGOS, periodoSiguiente, r2, sumarDias, suma } from './motor/fechas';
import {
  cuotaDiferido,
  cuotaFijaMensual,
  cuotasPagadasSeguidas,
  esPrestamoDetallado,
  esTarjetaDetallada,
  moraEstimada,
  pendientes,
  simularAbono,
  tasaDe,
} from './motor/obligaciones';
import { Proyeccion, proyeccion, totalMes } from './motor/proyeccion';
import { DeudaMotor, ETIQUETA_CARGO, Movimiento, TipoCargo } from './motor/tipos';

const fmt = (x: number): string =>
  (x < 0 ? '−' : '') + '$' + Math.abs(x).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number): string => `${n.toLocaleString('es-EC', { maximumFractionDigits: 2 })}%`;
const etiquetaMes = (per: string): string => {
  const [y, m] = per.split('-').map(Number);
  return `${MESES_LARGOS[m - 1][0].toUpperCase()}${MESES_LARGOS[m - 1].slice(1)} ${y}`;
};

/* ------------------------------------------------------------ lecciones */

export type TonoLeccion = 'ok' | 'warn' | 'bad' | 'info';

/** Ícono (lo dibuja la app): alerta, calendario, tijera, medidor, abajo, taza, pastel, reloj, moneda, suscripcion. */
export type IconoLeccion = 'alerta' | 'calendario' | 'tijera' | 'medidor' | 'abajo' | 'taza' | 'pastel' | 'reloj' | 'moneda' | 'suscripcion';

export interface Leccion {
  tono: TonoLeccion;
  icono: IconoLeccion;
  titulo: string;
  grande: string;
  /** Texto con los fragmentos importantes entre ** (negrita en la app). */
  texto: string;
  /** Botón opcional: pagar una obligación, simular un abono o ver ingresos. */
  accion: { tipo: 'pagar' | 'simular' | 'ingresos'; etiqueta: string; deudaId?: number; clave?: string } | null;
}

function lecciones(
  G: ResumenGlobal,
  Pr: Proyeccion,
  deudas: DeudaMotor[],
  n: Nombres,
  hoy: string,
  capacidad: ReturnType<typeof calcularCapacidad>,
): Leccion[] {
  const ing = G.ingreso;
  const out: Leccion[] = [];
  const nm = (d: DeudaMotor) => d.alias || d.acreedorNombre;

  if (G.vencidos.length) {
    const v = suma(G.vencidos, (x) => x.it.monto);
    const mora = suma(G.vencidos, (x) => moraEstimada(x.deuda, x.it, hoy));
    out.push({
      tono: 'bad',
      icono: 'alerta',
      titulo: 'Pagos vencidos',
      grande: fmt(v),
      texto: `${G.vencidos.map((x) => nm(x.deuda)).join(', ')}: ya pasó la fecha. Llevas ≈${fmt(mora)} de mora estimada y el atraso puede quedar en tu historial crediticio. Por eso registrar y recibir alertas vale la pena.`,
      accion: { tipo: 'pagar', etiqueta: 'Pagar ahora', deudaId: G.vencidos[0].deuda.id, clave: G.vencidos[0].it.clave },
    });
  }

  const tot = Pr.meses.map((_, i) => totalMes(Pr, i));
  if (tot.some((v) => v > 0)) {
    let mi = 0;
    tot.forEach((v, i) => {
      if (v > tot[mi]) mi = i;
    });
    const avg = suma(tot, (x) => x) / tot.length;
    const pc = ing ? (tot[mi] / ing) * 100 : 0;
    const consejo =
      mi === 0
        ? 'Es este mes: prioriza estos pagos antes de nuevos gastos.'
        : mi === 1
          ? `Aparta ${fmt(tot[mi] - avg)} extra este mes para llegar sin apuros.`
          : `Si apartas ${fmt((tot[mi] - avg) / mi)} cada mes desde ahora, llegarás sin apuros.`;
    out.push({
      tono: pc > 35 ? 'warn' : 'info',
      icono: 'calendario',
      titulo: 'Tu mes más pesado',
      grande: etiquetaMes(Pr.meses[mi]),
      texto: `Tienes comprometidos ${fmt(tot[mi])}${ing ? ` (${pct(r2(pc))} de tu ingreso)` : ''}; tu promedio mensual es ${fmt(avg)}. ${consejo}`,
      accion: null,
    });
  }

  const diferidos: { comercio: string; costo: number }[] = [];
  for (const d of G.activas.filter(esTarjetaDetallada)) {
    const i = (d.tarjeta?.tasa || 0) / 1200;
    for (const c of d.consumos.filter((x) => x.mod === 'dif_con')) {
      diferidos.push({ comercio: c.comercio, costo: r2(cuotaDiferido(c, i) * c.plazo - c.monto) });
    }
  }
  if (diferidos.length) {
    diferidos.sort((a, b) => b.costo - a.costo);
    out.push({
      tono: 'warn',
      icono: 'tijera',
      titulo: 'Lo que te cuesta diferir',
      grande: fmt(suma(diferidos, (x) => x.costo)),
      texto: `Es el interés extra por diferir con intereses: ${diferidos.slice(0, 3).map((x) => `${x.comercio} ${fmt(x.costo)}`).join(', ')}. Pagado de contado (o diferido sin intereses) te lo ahorrabas.`,
      accion: null,
    });
  }

  const dn = G.activas.find((d) => d.tipo === 'tarjeta' && d.modo === 'resumida' && (d.res?.minimo || 0) > 0 && d.res!.valor > d.res!.minimo!);
  if (dn) {
    const s = soloMinimo(dn.res!.valor, dn.res!.minimo!, tasaDe(dn));
    if (s) {
      out.push({
        tono: 'info',
        icono: 'medidor',
        titulo: 'La trampa del pago mínimo',
        grande: `${s.meses} meses`,
        texto: `Si pagas solo el mínimo de ${nm(dn)} (${fmt(dn.res!.minimo!)}), tardarías ${s.meses} meses en saldar ${fmt(dn.res!.valor)} y pagarías ${fmt(s.interes)} de intereses, sin hacer un solo consumo más. Pagando el total: $0.`,
        accion: null,
      });
    }
  }

  const creditos = G.activas
    .filter((d) => esPrestamoDetallado(d) && cuotasPagadasSeguidas(d) < d.amort!.rows.length - 1)
    .sort((a, b) => tasaDe(b) - tasaDe(a));
  if (creditos.length) {
    const d = creditos[0];
    const s = simularAbono(d.amort!.rows, tasaDe(d), cuotasPagadasSeguidas(d), 500, 'plazo');
    const p0 = pendientes(d, hoy)[0];
    out.push({
      tono: 'ok',
      icono: 'abajo',
      titulo: 'El poder de abonar a capital',
      grande: fmt(s.ahorro),
      texto: `Es lo que ahorras en intereses si abonas ${fmt(500)} a ${nm(d)} (tu crédito más caro, ${pct(tasaDe(d))}): terminas ${s.mesesMenos} cuota(s) antes. Abonar rinde lo mismo que la tasa del crédito, sin riesgo.`,
      accion: { tipo: 'simular', etiqueta: 'Simular abono', deudaId: d.id, clave: p0?.clave },
    });
  }

  // Gastos hormiga: suscripciones y restaurantes en la tarjeta (últimos 30 días).
  const desde30 = sumarDias(hoy, -30);
  const idSus = n.porCodigo.get('suscripciones');
  const hormiga = G.activas
    .filter(esTarjetaDetallada)
    .flatMap((d) => d.consumos)
    .filter((c) => c.fecha >= desde30 && (c.categoriaId === idSus || /restaurante/i.test(c.categoriaNombre || '')));
  if (hormiga.length) {
    const v = suma(hormiga, (c) => c.monto);
    out.push({
      tono: 'warn',
      icono: 'taza',
      titulo: 'Gastos hormiga en tu tarjeta',
      grande: `${fmt(v)} / mes`,
      texto: `Suscripciones y restaurantes en los últimos 30 días. Al año son ${fmt(v * 12)}. Solo lo ves porque registras tus consumos en detalle.`,
      accion: null,
    });
  }

  if (ing) {
    out.push({
      tono: G.endeudamiento > 40 ? 'bad' : G.endeudamiento > 30 ? 'warn' : 'ok',
      icono: 'pastel',
      titulo: 'Ingreso comprometido',
      grande: pct(r2(G.endeudamiento)),
      texto: `Tus cuotas fijas (préstamos, casas comerciales, diferidos y suscripciones) suman ${fmt(G.fijas)} de tus ${fmt(ing)}. Lo saludable es menos del 35%; ${G.endeudamiento > 35 ? 'estás por encima: evita nuevas deudas hasta bajar.' : 'aún tienes margen, pero cuídalo.'}`,
      accion: null,
    });
  }

  if (G.puntualidad.total) {
    const p = (G.puntualidad.aTiempo / G.puntualidad.total) * 100;
    const tarde = [...new Set(G.puntualidad.tarde.map((x) => nm(x.deuda)))];
    out.push({
      tono: p >= 90 ? 'ok' : 'warn',
      icono: 'reloj',
      titulo: 'Puntualidad',
      grande: pct(Math.round(p)),
      texto: `${G.puntualidad.aTiempo} de ${G.puntualidad.total} pagos a tiempo. ${tarde.length ? `Te atrasaste en: ${tarde.join(', ')}. Activa los avisos y paga 1–2 días antes.` : '¡Excelente hábito!'}`,
      accion: null,
    });
  }

  const capT = suma(G.infos, (x) => x.info.saldoCapital);
  if (capT > 0) {
    const c100 = (G.interesPendiente / (capT + G.interesPendiente)) * 100;
    out.push({
      tono: 'info',
      icono: 'moneda',
      titulo: 'El costo de deber',
      grande: fmt(G.interesPendiente),
      texto: `Es lo que aún pagarás en intereses y seguros. De cada $100 que te falta pagar, ${fmt(c100)} no reducen tu deuda. Cada abono a capital achica esta cifra.`,
      accion: null,
    });
  }

  const subs = G.activas.filter((d) => d.tipo === 'suscripcion');
  if (subs.length) {
    const smon = suma(subs, (d) => d.res?.valor || 0);
    out.push({
      tono: 'info',
      icono: 'suscripcion',
      titulo: 'Tus suscripciones',
      grande: `${fmt(smon)} / mes`,
      texto: `${subs.map((d) => `${nm(d)} ${fmt(d.res?.valor || 0)}${d.pagaCon ? ` (${deudaRef(d, n).pagaConNombre})` : ''}`).join(', ')}. Al año son ${fmt(smon * 12)}. Revisa si usas todas: cancelar una que no usas es ahorro inmediato.`,
      accion: null,
    });
  }

  const movs = deudas.flatMap((d) => d.movs);
  const cargos = suma(movs, (m) => m.partes.cargos || 0);
  if (cargos > 0) {
    const porTipo: Record<string, number> = {};
    for (const m of movs) for (const [k, v] of Object.entries(m.cargos || {})) porTipo[k] = (porTipo[k] || 0) + (v || 0);
    out.unshift({
      tono: 'bad',
      icono: 'alerta',
      titulo: 'Lo que te costó atrasarte',
      grande: fmt(cargos),
      texto: `Pagaste ${Object.entries(porTipo).map(([k, v]) => `${fmt(v)} en ${ETIQUETA_CARGO[k as TipoCargo].toLowerCase()}`).join(', ')}. Ese dinero no redujo ninguna deuda: pagando a tiempo lo evitabas.`,
      accion: null,
    });
  }

  const tp3 = gastoPorTipo(deudas, n, hoy, 3);
  if (ing && suma(Object.values(tp3), (x) => x) > 0) {
    const nec = ((tp3['Necesidad'] || 0) / 3 / ing) * 100;
    const gus = ((tp3['Gusto'] || 0) / 3 / ing) * 100;
    const fin = ((tp3['Obligación financiera'] || 0) / 3 / ing) * 100;
    out.push({
      tono: gus > 30 ? 'warn' : 'info',
      icono: 'pastel',
      titulo: 'Regla 50/30/20 con tus pagos',
      grande: `${pct(Math.round(nec))} · ${pct(Math.round(gus))} · ${pct(Math.round(fin))}`,
      texto: 'Necesidades · gustos · costo financiero, como % de tu ingreso fijo (promedio de 3 meses, solo lo que pagas con deudas y suscripciones). Lo recomendado: necesidades hasta 50%, gustos hasta 30% y al menos 20% para ahorrar.',
      accion: null,
    });
  }

  if (capacidad.ing) {
    out.push({
      tono: capacidad.margen >= 0 ? 'ok' : 'bad',
      icono: 'medidor',
      titulo: 'Capacidad de pago',
      grande: capacidad.margen >= 0 ? `${fmt(capacidad.margen)} / mes` : fmt(capacidad.margen),
      texto:
        capacidad.margen >= 0
          ? `Es lo que aún podrías destinar a nuevas cuotas sin pasar del 35% de tu ingreso fijo (${fmt(capacidad.ing)}). Que puedas no significa que debas.`
          : `Tus cuotas superan el 35% de tu ingreso fijo (${fmt(capacidad.ing)}): evita nuevas deudas.`,
      accion: { tipo: 'ingresos', etiqueta: 'Ver ingresos' },
    });
  }
  if (capacidad.terceros.cantidad) {
    out.push({
      tono: 'warn',
      icono: 'alerta',
      titulo: 'Pagos con dinero de otros',
      grande: fmt(capacidad.terceros.monto),
      texto: `${capacidad.terceros.cantidad} pago(s) se hicieron con cuentas o tarjetas de terceros. Registrarlo te muestra cuánto dependes de otros y cuánto les debes.`,
      accion: null,
    });
  }
  return out;
}

/* ---------------------------------------------------- origen del dinero */

function origenDe(m: Movimiento, n: Nombres): { clave: string; etiqueta: string; tipo: string } {
  const o = m.origen || {};
  if (o.tercero) return { clave: `ter:${o.tercero}`, etiqueta: `${o.tercero}${o.relacion ? ` (${o.relacion.toLowerCase()})` : ''}`, tipo: 'Tercero' };
  if (o.tarjetaId) {
    const t = n.tarjetas.get(o.tarjetaId);
    return { clave: `t:${o.tarjetaId}`, etiqueta: t?.nombre || 'Tarjeta', tipo: t?.tercero ? 'Tercero' : 'Tarjeta propia' };
  }
  if (o.cuentaId) {
    const c = n.cuentas.get(o.cuentaId);
    return { clave: `c:${o.cuentaId}`, etiqueta: c?.nombre || 'Cuenta', tipo: c?.tercero ? 'Tercero' : 'Cuenta propia' };
  }
  const medio = m.medio ? { transferencia: 'Transferencia', banca_movil: 'Banca móvil', debito_automatico: 'Débito automático', tarjeta_debito: 'Tarjeta de débito', tarjeta_credito: 'Tarjeta de crédito', efectivo: 'Ventanilla / efectivo', tercero: 'Pagó un tercero', otro: 'Otro' }[m.medio] || m.medio : null;
  return { clave: `m:${m.medio || '—'}`, etiqueta: medio ? `${medio} (sin detalle)` : 'Sin especificar', tipo: 'Sin detalle' };
}

/* -------------------------------------------------------------- reporte */

const META_TIPO: Record<TipoGasto, string> = {
  Necesidad: 'hasta 50%',
  Gusto: 'hasta 30%',
  'Ahorro e inversión': '20% o más',
  'Obligación financiera': 'lo menos posible',
  'Sin clasificar': 'clasifícalos',
};

const COLORES_SERIE = ['#3f52b5', '#f4a825', '#0e7d72', '#8a63c8', '#ef6461', '#26bd97', '#7c8ae0', '#d98a06', '#5a6178'];

async function base(usuarioId: number) {
  const hoy = hoyISO();
  const [deudas, n, ingresos] = await Promise.all([cargarCartera(usuarioId), cargarNombres(usuarioId), listarIngresosPorUsuario(usuarioId)]);
  const ing = await ingresoBase(usuarioId, ingresos, hoy);
  const G = resumenGlobal(deudas, ing, n, hoy);
  const Pr = proyeccion(deudas, hoy, 12);
  const cap = calcularCapacidad(ing, ingresos, deudas, n, hoy);
  return { hoy, deudas, n, G, Pr, cap };
}

/** Recomendaciones del asesor (las mismas lecciones de Reportes). */
export async function recomendacionesAsesor(usuarioId: number): Promise<Leccion[]> {
  const { hoy, deudas, n, G, Pr, cap } = await base(usuarioId);
  return lecciones(G, Pr, deudas, n, hoy, cap);
}

export async function reporteCompleto(usuarioId: number) {
  const { hoy, deudas, n, G, Pr, cap } = await base(usuarioId);
  const per = hoy.slice(0, 7);
  const ing = G.ingreso;
  const movs = deudas.flatMap((d) => d.movs);
  const tot = Pr.meses.map((_, i) => totalMes(Pr, i));
  const meses6 = Array.from({ length: 6 }, (_, i) => periodoSiguiente(per, i - 5));
  const desde6 = `${meses6[0]}-01`;

  // Pagado los últimos 6 meses: capital / intereses / seguros / multas.
  const pagado6 = meses6.map((m) => {
    const ms = movs.filter((x) => x.fecha.slice(0, 7) === m);
    const t = (k: 'capital' | 'interes' | 'seguro' | 'cargos') => r2(suma(ms, (x) => x.partes[k] || 0));
    return { mes: m, capital: t('capital'), interes: t('interes'), seguro: t('seguro'), cargos: t('cargos') };
  });

  // Por categoría (top 12) y por tipo (50/30/20).
  const porCategoria = [...gastoPorCategoria(deudas, n, desde6).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id, monto]) => {
      const c = n.categorias.get(id);
      return { nombre: c?.nombre || '—', emoji: c?.emoji || null, color: c?.color || '#7a84ab', monto: r2(monto) };
    });
  const tp6 = gastoPorTipo(deudas, n, hoy, 6);
  const porTipo = (Object.entries(tp6) as [TipoGasto, number][])
    .filter(([, v]) => v > 0.009)
    .map(([tipo, v]) => ({
      tipo,
      color: COLOR_TIPO[tipo],
      monto: r2(v),
      mensual: r2(v / 6),
      porcentajeIngreso: ing ? Math.round((v / 6 / ing) * 100) : null,
      meta: META_TIPO[tipo],
    }));

  // Origen del dinero (6 meses).
  const origenes = new Map<string, { etiqueta: string; tipo: string; pagos: number; monto: number }>();
  for (const m of movs.filter((x) => x.fecha >= desde6)) {
    const o = origenDe(m, n);
    const r = origenes.get(o.clave) || { etiqueta: o.etiqueta, tipo: o.tipo, pagos: 0, monto: 0 };
    r.pagos++;
    r.monto += m.monto;
    origenes.set(o.clave, r);
  }
  const origenT = suma([...origenes.values()], (x) => x.monto);
  const origen = [...origenes.values()]
    .sort((a, b) => b.monto - a.monto)
    .map((x) => ({ ...x, monto: r2(x.monto), porcentaje: origenT ? Math.round((x.monto / origenT) * 100) : 0 }));

  // Plan de pagos 12 meses (por deuda) y composición capital/interés/seguro.
  const plan = Pr.series.map((s, i) => ({
    deuda: s.deuda.alias || s.deuda.acreedorNombre,
    color: COLORES_SERIE[i % COLORES_SERIE.length],
    valores: s.v.map(r2),
  }));
  const comp = Pr.meses.map((_, i) => ({
    capital: r2(suma(Pr.series, (s) => s.cap[i])),
    interes: r2(suma(Pr.series, (s) => s.int[i])),
    seguro: r2(suma(Pr.series, (s) => s.seg[i])),
  }));
  let saldo = G.total;
  const saldos = comp.map((c) => {
    saldo = Math.max(0, saldo - c.capital);
    return r2(saldo);
  });

  // Puntualidad por mes (6 meses).
  const puntualidad = meses6.map((m) => {
    const ps = G.puntualidad.pagos.filter((x) => x.mov.fecha.slice(0, 7) === m);
    return { mes: m, aTiempo: ps.filter((x) => x.mov.fecha <= x.mov.fechaVence!).length, tarde: ps.filter((x) => x.mov.fecha > x.mov.fechaVence!).length };
  });

  // Consumos de tarjeta por categoría (90 días).
  const desde90 = sumarDias(hoy, -90);
  const cons = new Map<string, number>();
  for (const d of G.activas.filter(esTarjetaDetallada)) {
    for (const c of d.consumos.filter((x) => x.fecha >= desde90)) {
      const k = c.categoriaNombre || 'Sin categoría';
      cons.set(k, (cons.get(k) || 0) + c.monto);
    }
  }

  // Estrategia: avalancha (tasa) y bola de nieve (saldo).
  const filas = G.infos
    .filter((x) => x.info.saldoCapital > 0.009)
    .map((x) => ({
      deuda: deudaRef(x.deuda, n) as DeudaRefApi,
      saldo: r2(x.info.saldoCapital),
      tasa: x.info.tasa,
      cuota: cuotaFijaMensual(x.deuda, hoy),
    }));

  return {
    hoy,
    indicadores: {
      deudaTotal: G.total,
      deudasActivas: G.activas.length,
      porPagarMes: tot[0] || 0,
      porcentajeMes: ing ? Math.round(((tot[0] || 0) / ing) * 100) : null,
      interesPendiente: G.interesPendiente,
      endeudamiento: r2(G.endeudamiento),
    },
    lecciones: lecciones(G, Pr, deudas, n, hoy, cap),
    pagado6,
    resumenPagos: resumenCostos(movs),
    porCategoria,
    porTipo,
    origen,
    meses12: Pr.meses,
    plan,
    limite35: ing ? r2(ing * 0.35) : null,
    grupos: [...G.grupos.entries()].filter(([, v]) => v > 0.009).map(([grupo, monto]) => ({ grupo, monto: r2(monto), color: COLOR_GRUPO[grupo] })),
    composicion: comp,
    puntualidad,
    saldos,
    consumos90: [...cons.entries()].sort((a, b) => b[1] - a[1]).map(([categoria, monto]) => ({ categoria, monto: r2(monto) })),
    estrategia: {
      avalancha: [...filas].sort((a, b) => (b.tasa || 0) - (a.tasa || 0)),
      bolaDeNieve: [...filas].sort((a, b) => a.saldo - b.saldo),
      faltanTasas: filas.some((x) => !x.tasa),
    },
  };
}

