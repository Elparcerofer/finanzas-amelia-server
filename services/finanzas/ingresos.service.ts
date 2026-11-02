import {
  actualizarIngreso,
  crearIngreso,
  eliminarIngreso,
  Ingreso,
  IngresoFila,
  listarIngresosPorUsuario,
  obtenerIngresoPorId,
  sumaIngresosMensualesPorUsuario,
} from '../../models/finanzas/ingreso.model';
import { HttpError } from '../../middlewares/error.middleware';

export async function obtenerIngresosDeUsuario(usuarioId: number): Promise<IngresoFila[]> {
  return listarIngresosPorUsuario(usuarioId);
}

export async function obtenerIngreso(id: number): Promise<IngresoFila> {
  const ingreso = await obtenerIngresoPorId(id);
  if (!ingreso) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }
  return ingreso;
}

export async function registrarIngreso(usuarioId: number, datos: Omit<Ingreso, 'usuario_id'>): Promise<IngresoFila> {
  return crearIngreso({ ...datos, usuario_id: usuarioId });
}

export async function editarIngreso(id: number, datos: Partial<Ingreso>): Promise<IngresoFila> {
  const ingreso = await actualizarIngreso(id, datos);
  if (!ingreso) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }
  return ingreso;
}

export async function removerIngreso(id: number): Promise<void> {
  const eliminado = await eliminarIngreso(id);
  if (!eliminado) {
    throw new HttpError(404, 'Ingreso no encontrado');
  }
}

export async function obtenerIngresoMensualTotal(usuarioId: number): Promise<number> {
  return sumaIngresosMensualesPorUsuario(usuarioId);
}
