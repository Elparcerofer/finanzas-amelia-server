import Joi from 'joi';

const TIPOS_CATEGORIA = ['necesidad', 'gusto', 'ahorroInversion', 'obligacionFinanciera', 'sinClasificar'];

export const guardarCategoriaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  nombre: Joi.string().min(1).max(120).required(),
  grupo: Joi.string().max(60).allow(null, '').optional(),
  tipo: Joi.string().valid(...TIPOS_CATEGORIA).allow(null).optional(),
  emoji: Joi.string().max(10).allow(null, '').optional(),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'El color debe ser un hex como #26bd97' }),
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
