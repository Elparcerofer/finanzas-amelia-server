import {
  actualizarCategoria,
  CategoriaFinanzasFila,
  CategoriaFinanzasInput,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  obtenerCategoriaPorId,
} from '../../models/finanzas/categoria_finanzas.model';
import { HttpError } from '../../middlewares/error.middleware';

export interface CategoriaFinanzasApi {
  id: number;
  nombre: string;
  grupo: string | null;
  tipo: string;
  emoji: string | null;
  notas: string | null;
}

function aApi(fila: CategoriaFinanzasFila): CategoriaFinanzasApi {
  return {
    id: fila.id,
    nombre: fila.nombre,
    grupo: fila.grupo,
    tipo: fila.subtipo || 'sinClasificar',
    emoji: fila.emoji,
    notas: fila.notas,
  };
}

export async function obtenerCategorias(): Promise<CategoriaFinanzasApi[]> {
  const filas = await listarCategorias();
  return filas.map(aApi);
}

export async function obtenerCategoria(id: number): Promise<CategoriaFinanzasApi> {
  const fila = await obtenerCategoriaPorId(id);
  if (!fila) throw new HttpError(404, 'Categoría no encontrada');
  return aApi(fila);
}

export async function registrarCategoria(datos: CategoriaFinanzasInput): Promise<CategoriaFinanzasApi> {
  const fila = await crearCategoria(datos);
  return aApi(fila);
}

export async function editarCategoria(id: number, datos: CategoriaFinanzasInput): Promise<CategoriaFinanzasApi> {
  const existente = await obtenerCategoriaPorId(id);
  if (!existente) throw new HttpError(404, 'Categoría no encontrada');
  const fila = await actualizarCategoria(id, { ...existente, nombre: datos.nombre ?? existente.nombre, tipo: datos.tipo ?? existente.subtipo, grupo: datos.grupo ?? existente.grupo, emoji: datos.emoji ?? existente.emoji, notas: datos.notas ?? existente.notas });
  return aApi(fila as CategoriaFinanzasFila);
}

export async function borrarCategoria(id: number): Promise<void> {
  const eliminada = await eliminarCategoria(id);
  if (!eliminada) throw new HttpError(404, 'Categoría no encontrada');
}
