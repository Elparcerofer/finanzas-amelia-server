import Joi from 'joi';

const MARCAS = ['visa', 'mastercard', 'amex', 'diners', 'discover', 'unionPay'];
const TIPOS_TITULAR = ['principal', 'adicional'];
const USOS = ['personal', 'empresarial'];
const PROPIEDADES = ['propia', 'deTercero'];

export const guardarTarjetaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  entidadId: Joi.alternatives(Joi.string(), Joi.number()).required(),
  alias: Joi.string().min(1).max(80).required(),
  marca: Joi.string().valid(...MARCAS).optional(),
  titular: Joi.string().max(100).allow(null, '').optional(),
  tipoTitular: Joi.string().valid(...TIPOS_TITULAR).optional(),
  ultimos4: Joi.string().max(4).allow(null, '').optional(),
  vencimiento: Joi.string().max(7).allow(null, '').optional(),
  cupo: Joi.number().min(0).optional(),
  uso: Joi.string().valid(...USOS).optional(),
  propiedad: Joi.string().valid(...PROPIEDADES).optional(),
  prestadaPor: Joi.string().max(100).allow(null, '').optional(),
  corte: Joi.number().integer().min(1).max(31).allow(null).optional(),
  diaPago: Joi.number().integer().min(1).max(31).allow(null).optional(),
  tasaAnual: Joi.number().min(0).allow(null).optional(),
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
