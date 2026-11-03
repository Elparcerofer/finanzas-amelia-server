import {
  actualizarEntidad,
  buscarDuplicado,
  crearEntidad,
  eliminarEntidad,
  EntidadFinancieraFila,
  EntidadFinancieraInput,
  listarEntidades,
  obtenerEntidadPorId,
} from '../../models/finanzas/entidad_financiera.model';
import { HttpError } from '../../middlewares/error.middleware';
import { usosGlobales } from '../../models/finanzas/usos.model';
import { esRucEcuatorianoValido } from '../../utils/finanzas/validadores_ec';

/** RUC válido (si viene) y sin otra entidad con el mismo nombre/código. */
async function validar(datos: EntidadFinancieraInput, excluirId?: number): Promise<void> {
  if (datos.ruc && !esRucEcuatorianoValido(datos.ruc)) {
    throw new HttpError(400, 'RUC inválido');
  }
  const duplicada = await buscarDuplicado(datos.nombre, datos.codigo, excluirId);
  if (duplicada) {
    const mismoCodigo = !!datos.codigo && !!duplicada.codigo
      && duplicada.codigo.toUpperCase() === datos.codigo.toUpperCase();
    const motivo = mismoCodigo ? `el código "${duplicada.codigo}"` : `el nombre "${duplicada.nombre}"`;
    throw new HttpError(409, `Ya existe una entidad con ${motivo}`);
  }
}

export async function obtenerEntidades(): Promise<EntidadFinancieraFila[]> {
  return listarEntidades();
}

export async function obtenerEntidad(id: number): Promise<EntidadFinancieraFila> {
  const fila = await obtenerEntidadPorId(id);
  if (!fila) throw new HttpError(404, 'Entidad financiera no encontrada');
  return fila;
}

export async function registrarEntidad(datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila> {
  await validar(datos);
  return crearEntidad(datos);
}

export async function editarEntidad(id: number, datos: EntidadFinancieraInput): Promise<EntidadFinancieraFila> {
  const existente = await obtenerEntidadPorId(id);
  if (!existente) throw new HttpError(404, 'Entidad financiera no encontrada');
  await validar(datos, id);
  const fila = await actualizarEntidad(id, datos);
  return fila as EntidadFinancieraFila;
}

export async function borrarEntidad(id: number): Promise<void> {
  const n = await usosGlobales('entidades', id);
  if (n > 0) throw new HttpError(409, `No se puede eliminar: está en uso en ${n} registro(s).`);
  const eliminada = await eliminarEntidad(id);
  if (!eliminada) throw new HttpError(404, 'Entidad financiera no encontrada');
}
