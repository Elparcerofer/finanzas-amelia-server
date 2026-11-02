/**
 * Valida una cédula ecuatoriana usando el algoritmo módulo 10.
 */
export function esCedulaEcuatorianaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provincia = Number(cedula.substring(0, 2));
  if (provincia < 1 || provincia > 24) {
    return false;
  }

  const tercerDigito = Number(cedula[2]);
  if (tercerDigito > 6) {
    return false;
  }

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const digitoVerificador = Number(cedula[9]);

  const suma = coeficientes.reduce((acc, coef, i) => {
    let valor = Number(cedula[i]) * coef;
    if (valor >= 10) {
      valor -= 9;
    }
    return acc + valor;
  }, 0);

  const residuo = suma % 10;
  const resultado = residuo === 0 ? 0 : 10 - residuo;

  return resultado === digitoVerificador;
}

/**
 * Valida un número telefónico ecuatoriano (celular 09XXXXXXXX o convencional 0XXXXXXXX).
 */
export function esTelefonoEcuatorianoValido(telefono: string): boolean {
  return /^0(9\d{8}|[2-7]\d{7})$/.test(telefono);
}

/**
 * Valida el formato básico de un RUC ecuatoriano (13 dígitos, termina en 001 para personas naturales/jurídicas comunes).
 */
export function esRucEcuatorianoValido(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) {
    return false;
  }
  return esCedulaEcuatorianaValida(ruc.substring(0, 10)) && ruc.endsWith('001');
}
