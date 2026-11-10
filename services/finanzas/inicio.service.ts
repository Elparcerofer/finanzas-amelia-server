/**
 * Inicio (dashboard) de Finanzas — prototipo Solvenza: renderDash.
 * Asesor (Mateo), semáforo de salud financiera, deuda total por grupo,
 * próximos pagos, tarjeta más usada y la lección del pago mínimo.
 */
import { RowDataPacket } from 'mysql2';
import pool from '../../database/pool';
import { listarIngresosPorUsuario } from '../../models/finanzas/ingreso.model';
import { COLOR_GRUPO, Nivel, resumenGlobal, soloMinimo } from './analisis.service';
import { cargarCartera, cargarNombres, deudaRef, obligacionApi } from './cartera.service';
import { ingresoBase } from './ingresos.service';
import { hoyISO, r2, suma } from './motor/fechas';
import { esTarjetaDetallada, infoDeuda, itemsPeriodo, LEJOS, obligaciones, tasaDe } from './motor/obligaciones';

async function nombreUsuario(usuarioId: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(p.nombres, ''), u.alias) AS nombre
     FROM usuarios u LEFT JOIN perfiles p ON p.usuario_id = u.id WHERE u.id = ?`,
    [usuarioId],
  );
  const nombre = String(rows[0]?.nombre || '').trim();
  return nombre ? nombre.split(/\s+/)[0] : null;
}

export async function resumenInicio(usuarioId: number) {
  const hoy = hoyISO();
  const [deudas, n, ingresos, nombre] = await Promise.all([
    cargarCartera(usuarioId),
    cargarNombres(usuarioId),
    listarIngresosPorUsuario(usuarioId),
    nombreUsuario(usuarioId),
  ]);
  const ing = await ingresoBase(usuarioId, ingresos, hoy);
  const G = resumenGlobal(deudas, ing, n, hoy);
  const P = G.pendientes.map((x) => obligacionApi(x.deuda, x.it, hoy, n));

  // Semáforo
  const nivel: Nivel = G.score >= 80 ? 'ok' : G.score >= 60 ? 'warn' : 'bad';
  const peor = G.factores.find((x) => x[0] === 'bad') || G.factores.find((x) => x[0] === 'warn');

  // Tarjeta más usada: corriente vs. diferido.
  const top = [...G.tarjetas].sort((a, b) => b.saldo - a.saldo)[0];
  let tarjeta = null;
  if (top) {
    let corriente = 0;
    for (const d of top.deudas) {
      if (esTarjetaDetallada(d)) {
        for (const x of obligaciones(d, LEJOS, hoy).filter((o) => !o.futura)) {
          corriente += suma(itemsPeriodo(d, x.per!).filter((y) => !y.cuotaN), (y) => y.valor) * (x.monto / x.total);
        }
      } else {
        corriente += infoDeuda(d, hoy).saldoCapital;
      }
    }
    const t = top.tarjeta;
    const ref = deudaRef(top.deudas[0], n);
    tarjeta = {
      emisor: t.emisor,
      emisorWeb: ref.credWeb,
      emisorLogo: ref.credLogo,
      nombre: t.nombre,
      ultimos4: t.ult4,
      marca: t.marca,
      color: t.color,
      cupo: t.cupo,
      usado: r2(top.saldo),
      porcentaje: t.cupo ? Math.min(100, (top.saldo / t.cupo) * 100) : 0,
      corriente: r2(corriente),
      diferido: r2(Math.max(0, top.saldo - corriente)),
    };
  }

  // Lección "pagar más del mínimo" con una tarjeta resumida real.
  const dn = G.activas.find((d) => d.tipo === 'tarjeta' && d.modo === 'resumida' && (d.res?.minimo || 0) > 0 && d.res!.valor > d.res!.minimo!);
  const sm = dn ? soloMinimo(dn.res!.valor, dn.res!.minimo!, tasaDe(dn)) : null;

  // Reto del mes "Fondo anti-deuda": abonos extra a capital del mes frente a $200.
  const mes = hoy.slice(0, 7);
  const abonosMes = r2(
    suma(
      deudas.flatMap((d) => d.movs).filter((m) => m.fecha.slice(0, 7) === mes && m.accion === 'capital'),
      (m) => m.monto,
    ),
  );

  return {
    hoy,
    nombre,
    pendientes: P.length,
    proximos: P.slice(0, 4),
    alertaCercana: P.some((x) => x.diasHasta <= 3),
    coach: { primero: P[0] || null, siguiente: P[1] || null },
    salud: {
      score: G.score,
      nivel,
      estado: nivel === 'ok' ? 'Saludable ✅' : nivel === 'warn' ? 'Atención ⚠️' : 'En riesgo ⛔',
      texto: peor ? `Lo que más te resta: ${peor[1].toLowerCase()}.` : 'Tus indicadores están en verde. ¡Sigue así!',
      factores: G.factores.map(([nivelF, texto]) => ({ nivel: nivelF, texto })),
      vencidos: G.vencidos.length,
    },
    deuda: {
      total: G.total,
      grupos: [...G.grupos.entries()]
        .filter(([, v]) => v > 0.009)
        .sort((a, b) => b[1] - a[1])
        .map(([grupo, monto]) => ({ grupo, monto: r2(monto), color: COLOR_GRUPO[grupo] })),
      cuotasFijas: G.fijas,
      interesPendiente: G.interesPendiente,
    },
    tarjeta,
    leccion:
      dn && sm
        ? { deuda: deudaRef(dn, n), saldo: dn.res!.valor, minimo: dn.res!.minimo!, meses: sm.meses, interes: sm.interes }
        : null,
    reto: { meta: 200, avance: abonosMes },
  };
}
