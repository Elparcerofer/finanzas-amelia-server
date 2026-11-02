import Joi from 'joi';

const TIPOS_CATEGORIA = ['necesidad', 'gusto', 'ahorroInversion', 'obligacionFinanciera', 'sinClasificar'];

export const guardarCategoriaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  nombre: Joi.string().min(1).max(120).required(),
  grupo: Joi.string().max(60).allow(null, '').optional(),
  tipo: Joi.string().valid(...TIPOS_CATEGORIA).allow(null).optional(),
  emoji: Joi.string().max(10).allow(null, '').optional(),
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
