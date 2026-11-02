import { generarResumenFinanciero } from './reporteria.service';
import { CAPACIDAD_PAGO_MAX_RATIO_DEUDA_INGRESO } from '../../utils/finanzas/constantes_finanzas';

export interface Recomendacion {
  tipo: 'alerta' | 'sugerencia' | 'informativa';
  mensaje: string;
}

export async function generarRecomendaciones(usuarioId: number): Promise<Recomendacion[]> {
  const resumen = await generarResumenFinanciero(usuarioId);
  const recomendaciones: Recomendacion[] = [];

  if (resumen.ratio_deuda_ingreso > CAPACIDAD_PAGO_MAX_RATIO_DEUDA_INGRESO) {
    recomendaciones.push({
      tipo: 'alerta',
      mensaje: `Tu nivel de endeudamiento (${(resumen.ratio_deuda_ingreso * 100).toFixed(1)}%) supera el límite recomendado del ${CAPACIDAD_PAGO_MAX_RATIO_DEUDA_INGRESO * 100}%.`,
    });
  } else {
    recomendaciones.push({
      tipo: 'informativa',
      mensaje: 'Tu nivel de endeudamiento está dentro de un rango saludable.',
    });
  }

  const categoriaMayorGasto = resumen.consumos_por_categoria.sort((a, b) => b.total - a.total)[0];
  if (categoriaMayorGasto) {
    recomendaciones.push({
      tipo: 'sugerencia',
      mensaje: `La categoría con mayor gasto es la #${categoriaMayorGasto.categoria_id}. Revisa si puedes reducir ese consumo.`,
    });
  }

  return recomendaciones;
}
