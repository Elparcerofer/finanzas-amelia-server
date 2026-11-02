import { crearPago, eliminarPago, listarPagosPorDeuda, obtenerPagoPorId, Pago, PagoFila } from '../../models/finanzas/pago.model';
import { HttpError } from '../../middlewares/error.middleware';

/**
 * Sin pantalla de Flutter conectada todavía (ver registrar_pagos_screen.dart
 * — por ahora solo arma el formulario localmente, no llama a un repo/endpoint).
 * Este servicio queda como placeholder funcional: registra el pago, sin
 * recalcular saldo_pendiente/estado de la deuda (esa lógica deberá
 * definirse junto con el resto de la pantalla de Pagos).
 */
export async function obtenerPagosDeDeuda(deudaId: number): Promise<PagoFila[]> {
  return listarPagosPorDeuda(deudaId);
}

export async function obtenerPago(id: number): Promise<PagoFila> {
  const pago = await obtenerPagoPorId(id);
  if (!pago) {
    throw new HttpError(404, 'Pago no encontrado');
  }
  return pago;
}

export async function registrarPago(datos: Pago): Promise<PagoFila> {
  return crearPago(datos);
}

export async function removerPago(id: number): Promise<void> {
  const eliminado = await eliminarPago(id);
  if (!eliminado) {
    throw new HttpError(404, 'Pago no encontrado');
  }
}
