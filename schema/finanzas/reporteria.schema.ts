import Joi from 'joi';

export const rangoFechasSchema = Joi.object({
  desde: Joi.date().required(),
  hasta: Joi.date().greater(Joi.ref('desde')).required(),
});
