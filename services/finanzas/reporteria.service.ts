import { listarDeudasFilas } from '../../models/finanzas/deuda.model';
import { listarIngresosPorUsuario } from '../../models/finanzas/ingreso.model';
import { ingresoBase } from './ingresos.service';
import { resumenConsumosPorCategoria } from '../../models/finanzas/consumo.model';
import { redondearDosDecimales } from '../../utils/finanzas/formatters_finanzas';

export interface ResumenFinanciero {
  ingreso_mensual: number;
  deuda_total_pendiente: number;
  ratio_deuda_ingreso: number;
  consumos_por_categoria: { categoria_id: number; total: number }[];
}

export async function generarResumenFinanciero(usuarioId: number): Promise<ResumenFinanciero> {
  const [ingresoMensual, deudas, consumosPorCategoria] = await Promise.all([
    listarIngresosPorUsuario(usuarioId).then((i) => ingresoBase(usuarioId, i)),
    listarDeudasFilas(usuarioId),
    resumenConsumosPorCategoria(usuarioId),
  ]);

  const deudaTotalPendiente = deudas.reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);
  const ratio = ingresoMensual > 0 ? deudaTotalPendiente / ingresoMensual : 0;

  return {
    ingreso_mensual: redondearDosDecimales(ingresoMensual),
    deuda_total_pendiente: redondearDosDecimales(deudaTotalPendiente),
    ratio_deuda_ingreso: redondearDosDecimales(ratio),
    consumos_por_categoria: consumosPorCategoria,
  };
}

export async function generarHistorialIngresos(usuarioId: number) {
  return listarIngresosPorUsuario(usuarioId);
}
