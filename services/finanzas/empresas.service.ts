import {
  actualizarEmpresa,
  crearEmpresa,
  eliminarEmpresa,
  EmpresaCatalogoFila,
  EmpresaCatalogoInput,
  listarEmpresas,
  obtenerEmpresaPorId,
} from '../../models/finanzas/empresa_catalogo.model';
import { HttpError } from '../../middlewares/error.middleware';
import { usosGlobales } from '../../models/finanzas/usos.model';

export async function obtenerEmpresas(): Promise<EmpresaCatalogoFila[]> {
  return listarEmpresas();
}

export async function obtenerEmpresa(id: number): Promise<EmpresaCatalogoFila> {
  const fila = await obtenerEmpresaPorId(id);
  if (!fila) throw new HttpError(404, 'Empresa no encontrada');
  return fila;
}

export async function registrarEmpresa(datos: EmpresaCatalogoInput): Promise<EmpresaCatalogoFila> {
  return crearEmpresa(datos);
}

export async function editarEmpresa(id: number, datos: EmpresaCatalogoInput): Promise<EmpresaCatalogoFila> {
  const existente = await obtenerEmpresaPorId(id);
  if (!existente) throw new HttpError(404, 'Empresa no encontrada');
  const fila = await actualizarEmpresa(id, datos);
  return fila as EmpresaCatalogoFila;
}

export async function borrarEmpresa(id: number): Promise<void> {
  const n = await usosGlobales('empresas', id);
  if (n > 0) throw new HttpError(409, `No se puede eliminar: está en uso en ${n} registro(s).`);
  const eliminada = await eliminarEmpresa(id);
  if (!eliminada) throw new HttpError(404, 'Empresa no encontrada');
}
