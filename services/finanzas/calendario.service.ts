/**
 * Calendario de pagos (prototipo Solvenza: calEvents, evColor, renderCal):
 * lo que vence y lo que ya se pagó en un mes, día por día. Se calcula de
 * las deudas y sus pagos (no hay eventos que mantener a mano).
 */
import { HttpError } from '../../middlewares/error.middleware';
import { cargarCartera, cargarNombres, movimientoApi, obligacionApi } from './cartera.service';
import { diasHasta, hoyISO, r2, suma } from './motor/fechas';
import { obligaciones, pendientes } from './motor/obligaciones';
import { DeudaMotor, Obligacion } from './motor/tipos';

/** Color del punto del día (leyenda del calendario). */
export type ColorEvento = 'rojo' | 'ambar' | 'indigo' | 'turquesa' | 'menta';

function colorDe(d: DeudaMotor, it: Obligacion, hoy: string): ColorEvento {
  if (diasHasta(it.fecha, hoy) <= 3) return 'rojo';
  if (d.tipo === 'tarjeta') return 'ambar';
  return d.fuente === 'empresas' ? 'turquesa' : 'indigo';
}

export async function calendarioMes(usuarioId: number, mes?: string) {
  const hoy = hoyISO();
  const per = mes || hoy.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(per)) throw new HttpError(400, 'Mes no válido (YYYY-MM)');
  const [deudas, n] = await Promise.all([cargarCartera(usuarioId), cargarNombres(usuarioId)]);

  // Solo se puede pagar lo que está en "pendientes" (lo vencido + el próximo).
  const pagables = new Set(deudas.flatMap((d) => pendientes(d, hoy).map((x) => `${d.id}|${x.clave}`)));

  const eventos = [];
  for (const d of deudas) {
    for (const it of obligaciones(d, per, hoy)) {
      if (it.fecha.slice(0, 7) !== per) continue;
      eventos.push({
        tipo: 'pendiente' as const,
        fecha: it.fecha,
        color: colorDe(d, it, hoy),
        pagable: pagables.has(`${d.id}|${it.clave}`),
        monto: it.monto,
        obligacion: obligacionApi(d, it, hoy, n),
      });
    }
    for (const m of d.movs) {
      if (m.fecha.slice(0, 7) !== per) continue;
      eventos.push({ tipo: 'pagado' as const, fecha: m.fecha, color: 'menta' as ColorEvento, pagable: false, monto: m.monto, movimiento: movimientoApi(d, m, n) });
    }
  }
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const todosPend = deudas
    .flatMap((d) => pendientes(d, hoy).map((it) => ({ d, it })))
    .sort((a, b) => a.it.fecha.localeCompare(b.it.fecha));
  const urgentes = todosPend.filter((x) => diasHasta(x.it.fecha, hoy) <= 3);
  const porPagar = eventos.filter((e) => e.tipo === 'pendiente');
  const pagado = eventos.filter((e) => e.tipo === 'pagado');

  return {
    hoy,
    mes: per,
    eventos,
    porPagar: { monto: r2(suma(porPagar, (e) => e.monto)), cantidad: porPagar.length },
    pagado: { monto: r2(suma(pagado, (e) => e.monto)), cantidad: pagado.length },
    urgentes: urgentes.map((x) => obligacionApi(x.d, x.it, hoy, n)),
    proximo: todosPend[0] ? obligacionApi(todosPend[0].d, todosPend[0].it, hoy, n) : null,
  };
}
