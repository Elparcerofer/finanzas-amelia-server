import Joi from 'joi';

const id = Joi.number().integer().positive();
const periodo = Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/);

export const deudaParamsSchema = Joi.object({ deudaId: id.required() });
export const consumoParamsSchema = Joi.object({ deudaId: id.required(), consumoId: id.required() });
export const periodoParamsSchema = Joi.object({ deudaId: id.required(), periodo: periodo.required() });

export const panelQuerySchema = Joi.object({ periodo: periodo.optional() });

export const simularQuerySchema = Joi.object({
  monto: Joi.number().positive().required(),
  despues: Joi.number().integer().min(0).required(),
});

export const consumoSchema = Joi.object({
  fecha: Joi.date().iso().required(),
  comercio: Joi.string().trim().min(1).max(150).required(),
  categoriaId: id.required(),
  monto: Joi.number().positive().precision(2).required(),
  modalidad: Joi.string().valid('corriente', 'dif_con', 'dif_sin').required(),
  plazo: Joi.number().integer().min(1).max(120).optional(),
  mesesGracia: Joi.number().integer().min(0).max(12).optional(),
});

export const conciliacionSchema = Joi.object({
  valorEstado: Joi.number().min(0).allow(null),
  pagoReal: Joi.number().min(0).allow(null),
  fechaPago: Joi.date().iso().allow(null),
});

export const itemsSchema = Joi.object({
  claves: Joi.array().items(Joi.string().max(40)).min(1).max(500).required(),
  conciliado: Joi.boolean().required(),
});

export const pdfSchema = Joi.object({
  nombre: Joi.string().max(255).required(),
  // Hasta ~10 MB de PDF.
  base64: Joi.string().base64().max(14_000_000).required(),
  clave: Joi.string().max(100).allow(null, ''),
});
