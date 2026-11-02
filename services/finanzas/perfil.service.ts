import { actualizarPerfil, crearPerfil, obtenerPerfilPorUsuario, Perfil, PerfilFila } from '../../models/finanzas/perfil.model';
import { HttpError } from '../../middlewares/error.middleware';
import { esCedulaEcuatorianaValida } from '../../utils/finanzas/validadores_ec';

export async function obtenerPerfil(usuarioId: number): Promise<PerfilFila> {
  const perfil = await obtenerPerfilPorUsuario(usuarioId);
  if (!perfil) {
    throw new HttpError(404, 'Perfil no encontrado');
  }
  return perfil;
}

export async function registrarPerfil(usuarioId: number, datos: Omit<Perfil, 'usuario_id'>): Promise<PerfilFila> {
  if (!esCedulaEcuatorianaValida(datos.cedula)) {
    throw new HttpError(422, 'Cédula ecuatoriana inválida');
  }
  return crearPerfil({ ...datos, usuario_id: usuarioId });
}

export async function editarPerfil(usuarioId: number, datos: Partial<Perfil>): Promise<PerfilFila> {
  const perfil = await actualizarPerfil(usuarioId, datos);
  if (!perfil) {
    throw new HttpError(404, 'Perfil no encontrado');
  }
  return perfil;
}
