const formateadorMoneda = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export function formatearMoneda(valor: number): string {
  return formateadorMoneda.format(valor);
}

export function formatearFecha(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatearPorcentaje(valor: number): string {
  return `${(valor * 100).toFixed(2)}%`;
}

export function redondearDosDecimales(valor: number): number {
  return Math.round(valor * 100) / 100;
}
