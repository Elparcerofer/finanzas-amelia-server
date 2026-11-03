/**
 * Validación real del token de Amelia contra su propio backend.
 *
 * El token lo emite el login de Amelia y la app lo manda tal cual en el
 * header `x-token`. Este servicio de Finanzas no comparte el secreto con
 * el que Amelia firma el JWT, así que no se puede hacer jwt.verify()
 * local: se le pregunta al propio Amelia si el token es válido,
 * golpeando un endpoint autenticado liviano ya existente.
 *
 * Confirmado en vivo contra https://amelia-test.facturadoramelia.com/api/companias:
 *   - sin x-token / token inválido -> 401
 *   - con x-token válido           -> 200
 *
 * Esto es más estricto que verificar solo la firma: si Amelia revoca o
 * invalida una sesión, este chequeo también lo detecta. Se cachea el
 * resultado por token un rato corto para no golpear a Amelia en cada
 * petición. Si Amelia no responde NO se cachea ni se acepta el token
 * (fail-closed): se informa aparte para responder 503 y no confundirlo
 * con una sesión vencida.
 */

const AMELIA_BASE_URL = process.env.AMELIA_BASE_URL || 'https://amelia-test.facturadoramelia.com';
const AMELIA_PING_PATH = '/api/companias';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 5000;
const TIMEOUT_MS = 5000;

export type ResultadoValidacion = 'valido' | 'invalido' | 'sin_conexion';

interface EntradaCache {
  resultado: Exclude<ResultadoValidacion, 'sin_conexion'>;
  expiraEn: number;
}

const cache = new Map<string, EntradaCache>();

export async function validarTokenEnAmelia(token: string): Promise<ResultadoValidacion> {
  const ahora = Date.now();
  const entrada = cache.get(token);
  if (entrada && entrada.expiraEn > ahora) {
    return entrada.resultado;
  }

  const resultado = await consultarAmelia(token);
  if (resultado !== 'sin_conexion') {
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(token, { resultado, expiraEn: ahora + CACHE_TTL_MS });
  }
  return resultado;
}

async function consultarAmelia(token: string): Promise<ResultadoValidacion> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${AMELIA_BASE_URL}${AMELIA_PING_PATH}`, {
      headers: { 'x-token': token },
      signal: controlador.signal,
    });
    if (respuesta.status >= 200 && respuesta.status < 300) return 'valido';
    if (respuesta.status === 401 || respuesta.status === 403) return 'invalido';
    // 5xx u otra respuesta inesperada: Amelia no pudo decidir.
    return 'sin_conexion';
  } catch (error) {
    return 'sin_conexion';
  } finally {
    clearTimeout(timeout);
  }
}
