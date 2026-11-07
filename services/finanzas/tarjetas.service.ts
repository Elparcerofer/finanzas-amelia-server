import {
  actualizarTarjeta,
  crearTarjeta,
  cuentaEsDelUsuario,
  eliminarTarjeta,
  listarTarjetas,
  obtenerTarjetaPorId,
  TarjetaCreditoFila,
  TarjetaCreditoInput,
} from '../../models/finanzas/tarjeta_credito.model';
import {
  categoriaTarjetaPorId,
  marcaPorCodigo,
  marcaPorId,
} from '../../models/finanzas/tarjeta_catalogos.model';
import { HttpError } from '../../middlewares/error.middleware';
import { usosPropios } from '../../models/finanzas/usos.model';

export interface TarjetaCreditoApi {
  id: number;
  entidadId: number;
  alias: string;
  /** Código de la marca ('visa', 'mastercard', …) — compatibilidad. */
  marca: string;
  marcaId: number | null;
  marcaNombre: string | null;
  categoriaTarjetaId: number | null;
  categoriaTarjetaNombre: string | null;
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
  costoAnual: number | null;
  callcenter: string | null;
  asesor: string | null;
  asesorCelular: string | null;
  cuentaDebitoId: number | null;
  color: string;
  notas: string | null;
}

const num = (v: string | null) => (v !== null ? Number(v) : null);

function aApi(fila: TarjetaCreditoFila): TarjetaCreditoApi {
  return {
    id: fila.id,
    entidadId: fila.entidad_id,
    alias: fila.nombre,
    marca: fila.marca,
    marcaId: fila.marca_id,
    marcaNombre: fila.marca_nombre,
    categoriaTarjetaId: fila.categoria_tarjeta_id,
    categoriaTarjetaNombre: fila.categoria_tarjeta_nombre,
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
    tasaAnual: num(fila.tasa_anual_pct),
    costoAnual: num(fila.costo_anual),
    callcenter: fila.callcenter,
    asesor: fila.asesor,
    asesorCelular: fila.asesor_celular,
    cuentaDebitoId: fila.cuenta_debito_id,
    color: fila.color || 'indigo',
    notas: fila.notas,
  };
}

/**
 * Valida contra los catálogos y deja `marcaId` + `marcaCodigo` resueltos.
 * Marca: marcaId (preferido) o código en `marca`; sin ninguno, Visa.
 */
async function resolver(usuarioId: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoInput> {
  const marca = datos.marcaId
    ? await marcaPorId(Number(datos.marcaId))
    : await marcaPorCodigo(datos.marca || 'visa');
  if (!marca) throw new HttpError(400, 'Marca de tarjeta no válida');

  let categoriaTarjetaId: number | null = null;
  if (datos.categoriaTarjetaId) {
    const categoria = await categoriaTarjetaPorId(Number(datos.categoriaTarjetaId));
    if (!categoria) throw new HttpError(400, 'Categoría de tarjeta no válida');
    categoriaTarjetaId = categoria.id;
  }

  let cuentaDebitoId: number | null = null;
  if (datos.cuentaDebitoId) {
    cuentaDebitoId = Number(datos.cuentaDebitoId);
    if (!(await cuentaEsDelUsuario(usuarioId, cuentaDebitoId))) {
      throw new HttpError(400, 'La cuenta de débito no existe o no es tuya');
    }
  }

  return { ...datos, marcaId: marca.id, marcaCodigo: marca.codigo, categoriaTarjetaId, cuentaDebitoId };
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
  const fila = await crearTarjeta(usuarioId, await resolver(usuarioId, datos));
  return aApi(fila);
}

export async function editarTarjeta(usuarioId: number, id: number, datos: TarjetaCreditoInput): Promise<TarjetaCreditoApi> {
  const existente = await obtenerTarjetaPorId(usuarioId, id);
  if (!existente) throw new HttpError(404, 'Tarjeta no encontrada');
  const fila = await actualizarTarjeta(usuarioId, id, await resolver(usuarioId, datos));
  return aApi(fila as TarjetaCreditoFila);
}

export async function borrarTarjeta(usuarioId: number, id: number): Promise<void> {
  const n = await usosPropios(usuarioId, 'tarjetas', id);
  if (n > 0) throw new HttpError(409, `No se puede eliminar: está en uso en ${n} registro(s).`);
  const eliminada = await eliminarTarjeta(usuarioId, id);
  if (!eliminada) throw new HttpError(404, 'Tarjeta no encontrada');
}
