import {
  crearPago,
  deudaEsDelUsuario,
  eliminarPago,
  listarPagosPorDeuda,
  obtenerPagoPorId,
  Pago,
  PagoFila,
} from '../../models/finanzas/pago.model';
import { HttpError } from '../../middlewares/error.middleware';

/**
 * Sin pantalla de Flutter conectada todavía (ver registrar_pagos_screen.dart
 * — por ahora solo arma el formulario localmente, no llama a un repo/endpoint).
 * Este servicio queda como placeholder funcional: registra el pago, sin
 * recalcular saldo_pendiente/estado de la deuda (esa lógica deberá
 * definirse junto con el resto de la pantalla de Pagos).
 */
export async function obtenerPagosDeDeuda(usuarioId: number, deudaId: number): Promise<PagoFila[]> {
  return listarPagosPorDeuda(usuarioId, deudaId);
}

export async function obtenerPago(usuarioId: number, id: number): Promise<PagoFila> {
  const pago = await obtenerPagoPorId(usuarioId, id);
  if (!pago) {
    throw new HttpError(404, 'Pago no encontrado');
  }
  return pago;
}

export async function registrarPago(usuarioId: number, datos: Pago): Promise<PagoFila> {
  if (!(await deudaEsDelUsuario(usuarioId, datos.deuda_id))) {
    throw new HttpError(404, 'Deuda no encontrada');
  }
  return crearPago(usuarioId, datos);
}

export async function removerPago(usuarioId: number, id: number): Promise<void> {
  const eliminado = await eliminarPago(usuarioId, id);
  if (!eliminado) {
    throw new HttpError(404, 'Pago no encontrado');
  }
}
