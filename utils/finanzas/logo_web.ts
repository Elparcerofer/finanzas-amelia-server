import Joi from 'joi';

/**
 * Sitio web + logo propio de entidades y empresas (prototipo "Solvenza").
 *
 * Logo: la app ya lo recorta a cuadrado y lo reduce a 128×128 antes de
 * enviarlo; acá solo se acepta un data URI de imagen PNG/JPEG/WebP y se
 * pone un tope de tamaño para que un archivo sin procesar no llene la BD.
 */
export const LOGO_MAX_CARACTERES = 200_000; // ~150 KB de imagen

export const webSchema = Joi.string().trim().max(255)
  .pattern(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i)
  .allow(null, '').optional()
  .messages({ 'string.pattern.base': 'El sitio web no es válido (ej.: https://pichincha.com)' });

export const logoSchema = Joi.string()
  .max(LOGO_MAX_CARACTERES)
  .pattern(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/)
  .allow(null, '').optional()
  .messages({
    'string.pattern.base': 'El logo debe ser una imagen PNG, JPG o WebP',
    'string.max': 'El logo es demasiado pesado; súbelo de nuevo desde la app para optimizarlo',
  });

/** "pichincha.com" → "https://pichincha.com"; vacío → null. */
export function normalizarWeb(web: string | null | undefined): string | null {
  const t = (web || '').trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/**
 * Para los UPDATE: si el campo no vino en el body (app anterior que no
 * conoce web/logo) se conserva lo guardado; si vino vacío, se borra.
 * Devuelve [vino, valor] para `CASE WHEN ? THEN ? ELSE col END`.
 */
export function paraActualizar(valor: string | null | undefined, normalizar = (v: string | null | undefined) => v || null): [boolean, string | null] {
  return [valor !== undefined, normalizar(valor)];
}
