import {
  actualizarEntidad,
  crearEntidad,
  eliminarEntidad,
  EntidadFinancieraFila,
  EntidadFinancieraInput,
  listarEntidades,
  obtenerEntidadPorId,
} from '../../models/finanzas/entidad_financiera.model';
import { HttpError } from '../../middlewares/error.middleware';

export async function obtenerEntidades(): Promise<EntidadFinancieraFila[]> {
  return listarEntidades();
}

export async function obtenerEntidad(id: number): Promise<EntidadFinancieraFila> {
  const fila = await obtenerEntidadPorId(id);
  if (!fila) throw new HttpError(404, 'Entidad financiera no encontrada');
  return fila;
}

export async function registrarEntidad(datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila> {
  return crearEntidad(datos);
}

export async function editarEntidad(id: number, datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila> {
  const existente = await obtenerEntidadPorId(id);
  if (!existente) throw new HttpError(404, 'Entidad financiera no encontrada');
  const fila = await actualizarEntidad(id, datos);
  return fila as EntidadFinancieraFila;
}

export async function borrarEntidad(id: number): Promise<void> {
  const eliminada = await eliminarEntidad(id);
  if (!eliminada) throw new HttpError(404, 'Entidad financiera no encontrada');
}
