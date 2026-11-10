import Joi from 'joi';

const id = Joi.number().integer().positive();
const dinero = Joi.number().min(0).precision(2);

export const registrarPagoSchema = Joi.object({
  deudaId: id.required(),
  // Obligación que se paga (c:<n>, p:<YYYY-MM>, r, r+<k>); no aplica a abono a capital ni liquidación.
  clave: Joi.string().max(30).allow(null).when('accion', {
    is: Joi.valid('cuota', 'parcial'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  accion: Joi.string().valid('cuota', 'parcial', 'capital', 'liq_capital', 'liq_total').required(),
  montoPagado: dinero.positive().required(),
  fecha: Joi.date().iso().required(),
  medio: Joi.string()
    .valid('transferencia', 'banca_movil', 'debito_automatico', 'tarjeta_debito', 'tarjeta_credito', 'efectivo', 'tercero', 'otro')
    .required(),
  comprobante: Joi.string().max(255).allow('', null),
  modoAbono: Joi.string().valid('plazo', 'cuota').allow(null),
  origen: Joi.object({
    cuentaId: id.allow(null),
    tarjetaId: id.allow(null),
    agencia: Joi.string().max(120).allow('', null),
    tercero: Joi.string().max(150).allow('', null),
    relacion: Joi.string().max(30).allow('', null),
  }).allow(null),
  categorias: Joi.array()
    .items(Joi.object({ categoriaId: id.required(), monto: dinero.default(0) }))
    .max(20)
    .allow(null),
  cargos: Joi.array()
    .items(Joi.object({ tipo: Joi.string().valid('cobranza', 'multa', 'comision', 'otros').required(), monto: dinero.required() }))
    .unique('tipo')
    .allow(null),
});

export const anularPagoSchema = Joi.object({
  motivo: Joi.string().max(255).allow('', null),
});

export const simularAbonoSchema = Joi.object({
  monto: dinero.positive().required(),
  modo: Joi.string().valid('plazo', 'cuota').default('plazo'),
});

export const idParamsSchema = Joi.object({ id: id.required() });

export const deudaIdParamsSchema = Joi.object({ deudaId: id.required() });
