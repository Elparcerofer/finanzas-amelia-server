import {
  actualizarCuenta,
  crearCuenta,
  CuentaBancariaFila,
  CuentaBancariaInput,
  eliminarCuenta,
  listarCuentas,
  obtenerCuentaPorId,
} from '../../models/finanzas/cuenta_bancaria.model';
import { HttpError } from '../../middlewares/error.middleware';

export interface CuentaBancariaApi {
  id: number;
  alias: string;
  tipoCuenta: string;
  entidadId: number | null;
  ultimos4: string | null;
  titular: string | null;
  propiedad: string;
  relacion: string | null;
  notas: string | null;
}

function aApi(fila: CuentaBancariaFila): CuentaBancariaApi {
  return {
    id: fila.id,
    alias: fila.alias,
    tipoCuenta: fila.tipo_cuenta,
    entidadId: fila.entidad_id,
    ultimos4: fila.ultimos4,
    titular: fila.titular,
    propiedad: fila.propiedad,
    relacion: fila.relacion,
    notas: fila.notas,
  };
}

export async function obtenerCuentas(usuarioId: number): Promise<CuentaBancariaApi[]> {
  const filas = await listarCuentas(usuarioId);
  return filas.map(aApi);
}

export async function obtenerCuenta(usuarioId: number, id: number): Promise<CuentaBancariaApi> {
  const fila = await obtenerCuentaPorId(usuarioId, id);
  if (!fila) throw new HttpError(404, 'Cuenta no encontrada');
  return aApi(fila);
}

export async function registrarCuenta(usuarioId: number, datos: CuentaBancariaInput): Promise<CuentaBancariaApi> {
  const fila = await crearCuenta(usuarioId, datos);
  return aApi(fila);
}

export async function editarCuenta(usuarioId: number, id: number, datos: CuentaBancariaInput): Promise<CuentaBancariaApi> {
  const existente = await obtenerCuentaPorId(usuarioId, id);
  if (!existente) throw new HttpError(404, 'Cuenta no encontrada');
  const fila = await actualizarCuenta(usuarioId, id, datos);
  return aApi(fila as CuentaBancariaFila);
}

export async function borrarCuenta(usuarioId: number, id: number): Promise<void> {
  const eliminada = await eliminarCuenta(usuarioId, id);
  if (!eliminada) throw new HttpError(404, 'Cuenta no encontrada');
}
