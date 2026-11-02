import {
  crearEventoCalendario,
  eliminarEventoCalendario,
  EventoCalendario,
  EventoCalendarioFila,
  listarEventosPorUsuario,
} from '../../models/finanzas/evento_calendario.model';
import { HttpError } from '../../middlewares/error.middleware';

export async function obtenerEventosDeUsuario(usuarioId: number, desde?: string, hasta?: string): Promise<EventoCalendarioFila[]> {
  return listarEventosPorUsuario(usuarioId, desde, hasta);
}

export async function registrarEvento(usuarioId: number, datos: Omit<EventoCalendario, 'usuario_id'>): Promise<EventoCalendarioFila> {
  return crearEventoCalendario({ ...datos, usuario_id: usuarioId });
}

export async function removerEvento(id: number): Promise<void> {
  const eliminado = await eliminarEventoCalendario(id);
  if (!eliminado) {
    throw new HttpError(404, 'Evento de calendario no encontrado');
  }
}
