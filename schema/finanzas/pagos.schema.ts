import Joi from 'joi';

export const crearPagoSchema = Joi.object({
  deuda_id: Joi.number().integer().positive().required(),
  monto: Joi.number().positive().required(),
  fecha_pago: Joi.date().required(),
  metodo_pago: Joi.string().valid('efectivo', 'transferencia', 'tarjeta', 'debito_automatico').required(),
  comprobante: Joi.string().max(255).optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
