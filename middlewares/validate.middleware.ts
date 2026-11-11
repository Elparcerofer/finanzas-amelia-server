import { NextFunction, Request, Response } from 'express';
import { LanguageMessages, ObjectSchema } from 'joi';

type Fuente = 'body' | 'params' | 'query';

/**
 * Nombres que ve el usuario para los campos de la API. Los que no estén
 * aquí se muestran con su nombre técnico entre comillas.
 */
const NOMBRES: Record<string, string> = {
  alias: 'el nombre',
  nombre: 'el nombre',
  nombreCompleto: 'el nombre completo',
  cedula: 'la cédula',
  correo: 'el correo',
  telefono: 'el teléfono',
  ultimos4: 'los últimos 4 dígitos',
  vencimiento: 'el vencimiento',
  cupo: 'el cupo',
  corte: 'el día de corte',
  diaPago: 'el día de pago',
  tasaAnual: 'la tasa anual',
  costoAnual: 'el costo anual',
  tipoCuenta: 'el tipo de cuenta',
  tipo: 'el tipo',
  modo: 'el modo de registro',
  avisoDias: 'los días de aviso',
  monto: 'el monto',
  montoPagado: 'el monto pagado',
  valor: 'el valor',
  minimo: 'el pago mínimo',
  saldo: 'el saldo',
  plazo: 'el plazo',
  plazoMeses: 'el plazo en meses',
  mesesGracia: 'los meses de gracia',
  fecha: 'la fecha',
  fechaInicio: 'la fecha de inicio',
  medio: 'el medio de pago',
  accion: 'el tipo de pago',
  periodicidad: 'la periodicidad',
  hasta: 'la fecha "hasta"',
  comercio: 'el comercio',
  categoriaId: 'la categoría',
  modalidad: 'la modalidad',
  mes: 'el mes',
};

const MENSAJES: LanguageMessages = {
  'any.required': 'Falta {{#label}}',
  'any.only': '{{#label}} no es una opción válida',
  'any.invalid': '{{#label}} no es válido',
  'string.base': '{{#label}} debe ser texto',
  'string.empty': 'Completa {{#label}}',
  'string.min': '{{#label}} debe tener al menos {{#limit}} caracteres',
  'string.max': '{{#label}} admite máximo {{#limit}} caracteres',
  'string.email': '{{#label}} no es un correo válido',
  'string.pattern.base': '{{#label}} no tiene el formato correcto',
  'number.base': '{{#label}} debe ser un número',
  'number.min': '{{#label}} debe ser mayor o igual a {{#limit}}',
  'number.max': '{{#label}} debe ser menor o igual a {{#limit}}',
  'number.positive': '{{#label}} debe ser mayor a 0',
  'number.integer': '{{#label}} debe ser un número entero',
  'number.precision': '{{#label}} admite máximo {{#limit}} decimales',
  'date.base': '{{#label}} no es una fecha válida',
  'date.format': '{{#label}} no es una fecha válida',
  'array.base': '{{#label}} debe ser una lista',
  'array.min': '{{#label}} necesita al menos {{#limit}} elemento(s)',
  'array.max': '{{#label}} admite máximo {{#limit}} elementos',
  'array.unique': '{{#label}} tiene valores repetidos',
  'boolean.base': '{{#label}} debe ser verdadero o falso',
  'object.base': '{{#label}} no es válido',
  'object.min': 'Envía al menos un dato para guardar',
  'alternatives.match': '{{#label}} no es válido',
  'alternatives.types': '{{#label}} no es válido',
};

const capitalizar = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function validate(schema: ObjectSchema, fuente: Fuente = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[fuente], {
      abortEarly: false,
      stripUnknown: true,
      messages: MENSAJES,
      errors: { wrap: { label: false } },
    });

    if (error) {
      const mensajes = error.details.map((d) => {
        // La etiqueta por defecto es la ruta (p. ej. "consumos[0].plazo"):
        // se reemplaza por el nombre amigable del último campo.
        const campo = String(d.path[d.path.length - 1] ?? '');
        const nombre = NOMBRES[campo];
        const etiqueta = d.context?.label ?? campo;
        // Solo los mensajes genéricos de MENSAJES llevan la etiqueta
        // técnica; los personalizados del schema ya están redactados.
        const plantilla = MENSAJES[d.type];
        const render = (lbl: string) =>
          String(plantilla).split('{{#label}}').join(lbl).split('{{#limit}}').join(String(d.context?.limit ?? ''));
        const generico = typeof plantilla === 'string' && render(etiqueta) === d.message;
        const texto = generico && nombre ? render(nombre) : d.message;
        const fila = d.path.find((p) => typeof p === 'number');
        return capitalizar(texto) + (typeof fila === 'number' ? ` (fila ${fila + 1})` : '');
      });
      res.status(400).json({ msg: [...new Set(mensajes)].join('; ') });
      return;
    }

    req[fuente] = value;
    next();
  };
}
