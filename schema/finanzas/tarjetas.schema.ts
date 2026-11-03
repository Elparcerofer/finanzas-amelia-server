import Joi from 'joi';

const TIPOS_TITULAR = ['principal', 'adicional'];
const USOS = ['personal', 'empresarial'];
const PROPIEDADES = ['propia', 'deTercero'];
const id = () => Joi.alternatives(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/));

export const guardarTarjetaSchema = Joi.object({
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  entidadId: Joi.alternatives(Joi.string(), Joi.number()).required(),
  alias: Joi.string().min(1).max(80).required(),
  // La marca ya no es una lista fija: se valida contra marcas_tarjeta en el
  // servicio. Se acepta marcaId (preferido) o el código en `marca`
  // (compatibilidad con la app anterior).
  marcaId: id().allow(null).optional(),
  marca: Joi.string().max(20).allow(null, '').optional(),
  categoriaTarjetaId: id().allow(null).optional(),
  titular: Joi.string().max(100).allow(null, '').optional(),
  tipoTitular: Joi.string().valid(...TIPOS_TITULAR).optional(),
  ultimos4: Joi.string().pattern(/^\d{4}$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'Los últimos 4 dígitos deben ser 4 números' }),
  vencimiento: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).allow(null, '').optional()
    .messages({ 'string.pattern.base': 'El vencimiento debe tener el formato AAAA-MM' }),
  cupo: Joi.number().min(0).allow(null).optional(),
  uso: Joi.string().valid(...USOS).optional(),
  propiedad: Joi.string().valid(...PROPIEDADES).optional(),
  prestadaPor: Joi.string().max(100).allow(null, '').optional(),
  corte: Joi.number().integer().min(1).max(31).allow(null).optional(),
  diaPago: Joi.number().integer().min(1).max(31).allow(null).optional(),
  tasaAnual: Joi.number().min(0).max(100).allow(null).optional(),
  costoAnual: Joi.number().min(0).allow(null).optional(),
  callcenter: Joi.string().max(20).allow(null, '').optional(),
  asesor: Joi.string().max(100).allow(null, '').optional(),
  asesorCelular: Joi.string().max(20).allow(null, '').optional(),
  cuentaDebitoId: id().allow(null).optional(),
  // Color de la tarjeta en la app (prototipo: Índigo, Turquesa, Morado, Negro, Dorado, Coral).
  color: Joi.string().valid('indigo', 'teal', 'purple', 'black', 'gold', 'coral').allow(null).optional(),
  notas: Joi.string().max(255).allow(null, '').optional(),
});

export const idParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
