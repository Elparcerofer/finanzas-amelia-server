/**
 * Validación real del token de Amelia contra su propio backend.
 *
 * Este servicio de Finanzas no comparte el secreto con el que Amelia
 * firma el JWT (no existe forma segura de obtenerlo desde aquí), así
 * que no se puede hacer jwt.verify() local. En su lugar se usa el
 * patrón estándar para un microservicio que no es dueño del emisor de
 * identidad: se le pregunta al propio Amelia si el token es válido,
 * golpeando un endpoint autenticado liviano ya existente.
 *
 * Confirmado en vivo (2026-10-30) contra
 * https://amelia-test.facturadoramelia.com/api/companias:
 *   - sin x-token           -> 401
 *   - con x-token válido    -> 200
 *
 * Esto es más estricto que verificar solo la firma: si Amelia revoca
 * o invalida una sesión del lado del servidor, este chequeo también lo
 * detecta. El costo es una llamada de red; se cachea el resultado por
 * token un rato corto para no golpear a Amelia en cada petición.
 */

const AMELIA_BASE_URL = process.env.AMELIA_BASE_URL || 'https://amelia-test.facturadoramelia.com';
const AMELIA_PING_PATH = '/api/companias';
const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 5000;

interface EntradaCache {
  valido: boolean;
  expiraEn: number;
}

const cache = new Map<string, EntradaCache>();

export async function tokenEsValidoEnAmelia(token: string): Promise<boolean> {
  const ahora = Date.now();
  const entrada = cache.get(token);
  if (entrada && entrada.expiraEn > ahora) {
    return entrada.valido;
  }

  const valido = await consultarAmelia(token);
  cache.set(token, { valido, expiraEn: ahora + CACHE_TTL_MS });
  return valido;
}

async function consultarAmelia(token: string): Promise<boolean> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${AMELIA_BASE_URL}${AMELIA_PING_PATH}`, {
      headers: { 'x-token': token },
      signal: controlador.signal,
    });
    return respuesta.status >= 200 && respuesta.status < 300;
  } catch (error) {
    // Amelia caída/inalcanzable: se trata como token no válido (fail-closed),
    // no como usuario anónimo.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
