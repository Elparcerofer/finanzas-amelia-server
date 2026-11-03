/**
 * Validación de cédula y RUC ecuatorianos — misma lógica que la app móvil
 * (FlutterAppRimpe: lib/core/utils/identificacion_validator.dart).
 *
 * Cédula (10): provincia 01..24 o 30, tercer dígito < 6, verificador módulo 10.
 * RUC (13): provincia válida, no termina en 000, y según el tercer dígito:
 *   0..5 persona natural (cédula válida), 9 sociedad privada (módulo 11,
 *   verificador en posición 10), 6 entidad pública (módulo 11, verificador
 *   en posición 9). 7 y 8 son inválidos.
 *
 * ⚠️ El SRI emitió RUC de sociedades recientes que no cumplen el módulo 11:
 * mientras BLOQUEAR_SOCIEDAD_SIN_MODULO_11 sea false se aceptan si el resto
 * de la estructura es correcta. Mantener igual que en la app.
 */
export const BLOQUEAR_SOCIEDAD_SIN_MODULO_11 = false;

function provinciaValida(v: string): boolean {
  const p = Number(v.substring(0, 2));
  return (p >= 1 && p <= 24) || p === 30;
}

function modulo10(d: number[]): number {
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let p = d[i] * (i % 2 === 0 ? 2 : 1);
    if (p > 9) p -= 9;
    suma += p;
  }
  return (10 - (suma % 10)) % 10;
}

/** -1 si el resultado es 10 (ningún dígito verificador lo cumple). */
function modulo11(d: number[], coef: number[]): number {
  const suma = coef.reduce((acc, c, i) => acc + d[i] * c, 0);
  const r = 11 - (suma % 11);
  if (r === 11) return 0;
  if (r === 10) return -1;
  return r;
}

export function esCedulaEcuatorianaValida(cedula: string): boolean {
  const v = String(cedula ?? '').trim();
  if (!/^\d{10}$/.test(v) || !provinciaValida(v)) return false;
  const d = [...v].map(Number);
  if (d[2] >= 6) return false;
  return modulo10(d) === d[9];
}

export function esRucEcuatorianoValido(ruc: string): boolean {
  const v = String(ruc ?? '').trim();
  if (!/^\d{13}$/.test(v) || !provinciaValida(v) || v.endsWith('000')) return false;
  const d = [...v].map(Number);
  const tercero = d[2];
  if (tercero < 6) return esCedulaEcuatorianaValida(v.substring(0, 10));
  if (tercero === 9) {
    const ok = modulo11(d, [4, 3, 2, 7, 6, 5, 4, 3, 2]) === d[9];
    return ok || !BLOQUEAR_SOCIEDAD_SIN_MODULO_11;
  }
  if (tercero === 6) return modulo11(d, [3, 2, 7, 6, 5, 4, 3, 2]) === d[8];
  return false;
}

/**
 * Valida un número telefónico ecuatoriano (celular 09XXXXXXXX o convencional 0XXXXXXXX).
 */
export function esTelefonoEcuatorianoValido(telefono: string): boolean {
  return /^0(9\d{8}|[2-7]\d{7})$/.test(telefono);
}
