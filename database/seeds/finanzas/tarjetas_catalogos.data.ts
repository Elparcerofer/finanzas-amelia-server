/**
 * Datos base de los catálogos de tarjeta (ver migración 016).
 * El orden del arreglo es el orden en que se muestran en los combos.
 *
 * Los códigos de marca coinciden con los valores que ya tenía la columna
 * tarjetas_credito.marca ('visa', 'mastercard', …) para poder migrar las
 * tarjetas existentes sin perder datos.
 */
export const MARCAS_TARJETA: { codigo: string; nombre: string }[] = [
  { codigo: 'visa', nombre: 'Visa' },
  { codigo: 'mastercard', nombre: 'Mastercard' },
  { codigo: 'amex', nombre: 'American Express' },
  { codigo: 'diners', nombre: 'Diners Club' },
  { codigo: 'discover', nombre: 'Discover' },
  { codigo: 'unionPay', nombre: 'UnionPay' },
];

/** Nivel / categoría de la tarjeta (prototipo: campo "Nivel"). */
export const CATEGORIAS_TARJETA: { codigo: string; nombre: string }[] = [
  { codigo: 'clasica', nombre: 'Clásica' },
  { codigo: 'oro', nombre: 'Oro' },
  { codigo: 'platinum', nombre: 'Platinum' },
  { codigo: 'black', nombre: 'Black' },
  { codigo: 'signature', nombre: 'Signature' },
  { codigo: 'infinite', nombre: 'Infinite' },
  { codigo: 'worldElite', nombre: 'World Elite' },
  { codigo: 'titanium', nombre: 'Titanium' },
  { codigo: 'empresarial', nombre: 'Empresarial' },
];
