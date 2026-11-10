/**
 * Lectura del PDF del estado de cuenta de la tarjeta (prototipo Solvenza:
 * pdfText + extractAmounts). Extrae el texto, todos los montos con
 * decimales y los valores típicos (total a pagar, pago mínimo, saldo).
 * El PDF y su clave no se guardan: solo los montos detectados.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

export class PdfConClave extends Error {
  constructor(public incorrecta: boolean) {
    super(incorrecta ? 'Contraseña incorrecta' : 'El PDF tiene contraseña');
  }
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

/** "1.234,56" / "1,234.56" / "234.56" → número. */
export function aNumero(v: string): number {
  let s = v.replace(/[^\d.,-]/g, '');
  const dec = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (dec > -1 && s.length - dec - 1 <= 2) s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  else s = s.replace(/[.,]/g, '');
  return parseFloat(s);
}

export async function textoDelPdf(datos: Uint8Array, clave?: string | null): Promise<string> {
  const tarea = pdfjs.getDocument({ data: datos, password: clave || undefined, isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  let doc;
  try {
    doc = await tarea.promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err.name === 'PasswordException') throw new PdfConClave(err.code === 2);
    throw e;
  }
  let texto = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const contenido = await pagina.getTextContent();
    texto += contenido.items.map((x: { str?: string }) => x.str || '').join(' ') + '\n';
  }
  await doc.destroy();
  return texto;
}

export interface MontosPdf {
  montos: number[];
  sugeridos: { etiqueta: string; valor: number }[];
}

export function extraerMontos(texto: string): MontosPdf {
  const re = /(?<![\d.,])\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)/g;
  const montos = [...new Set((texto.match(re) || []).map(aNumero).filter((v) => v > 0 && v < 1e7).map(r2))];
  const bajo = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sugeridos: MontosPdf['sugeridos'] = [];
  const buscar: [string, RegExp][] = [
    ['Total a pagar', /total a pagar|valor a pagar|pago total|pago de contado|pago contado/],
    ['Pago mínimo', /pago minimo/],
    ['Saldo total', /saldo total|nuevo saldo|saldo actual/],
  ];
  for (const [etiqueta, rx] of buscar) {
    const m = rx.exec(bajo);
    if (!m) continue;
    const a = bajo.slice(m.index, m.index + 160).match(/\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)/);
    if (a) sugeridos.push({ etiqueta, valor: r2(aNumero(a[0])) });
  }
  return { montos, sugeridos };
}
