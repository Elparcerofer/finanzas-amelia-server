import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  obtenerTarjetaPorId,
  TarjetaCreditoFila,
  TarjetaCreditoInput,
} from '../../models/finanzas/tarjeta_credito.model';
import { HttpError } from '../../middlewares/error.middleware';

export interface TarjetaCreditoApi {
  id: number;
  entidadId: number;
  alias: string;
  marca: string;
  titular: string | null;
  tipoTitular: string;
  ultimos4: string | null;
  vencimiento: string | null;
  cupo: number;
  uso: string;
  propiedad: string;
  prestadaPor: string | null;
  corte: number | null;
  diaPago: number | null;
  tasaAnual: number | null;
  notas: string | null;
}

function aApi(fila: TarjetaCreditoFila): TarjetaCreditoApi {
  return {
    id: fila.id,
    entidadId: fila.catalogo_id,
    alias: fila.nombre,
    marca: fila.marca,
    titular: fila.titular,
    tipoTitular: fila.tipo_titular,
    ultimos4: fila.ultimos4,
    vencimiento: fila.vencimiento,
    cupo: Number(fila.cupo),
    uso: fila.uso,
    propiedad: fila.propiedad,
    prestadaPor: fila.prestada_por,
    corte: fila.dia_corte,
    diaPago: fila.dia_pago,
    tasaAnual: fila.tasa_anual_pct !== null ? Number(fila.tasa_anual_pct) : null,
    notas: fila.notas,
  };
}

export async function obtenerTarjetas(usuarioId: number): Promise<TarjetaCreditoApi[]> {
  const filas = await listarTarjetas(usuarioId);
  return filas.map(aApi);
}

export async function obtenerTarjeta(usuarioId: number, id: number): Promise<TarjetaCreditoApi> {
  const fila = await obtenerTarjetaPorId(usuarioId, id);
  if (!fila) throw new HttpError(404, 'Tarjeta no encontrada');
  return aApi(fila);
}

export async function registrarTarjeta(usuarioId: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoApi> {
  const fila = await crearTarjeta(usuarioId, datos);
  return aApi(fila);
}

export async function editarTarjeta(usuarioId: number, id: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoApi> {
  const existente = await obtenerTarjetaPorId(usuarioId, id);
  if (!existente) throw new HttpError(404, 'Tarjeta no encontrada');
  const fila = await actualizarTarjeta(usuarioId, id, datos);
  return aApi(fila as TarjetaCreditoFila);
}

export async function borrarTarjeta(usuarioId: number, id: number): Promise<void> {
  const eliminada = await eliminarTarjeta(usuarioId, id);
  if (!eliminada) throw new HttpError(404, 'Tarjeta no encontrada');
}
