/**
 * Modelo en memoria del motor de obligaciones (prototipo Solvenza,
 * "MOTOR DE OBLIGACIONES Y PAGOS"). Se arma desde la BD
 * (models/finanzas/motor.model.ts) y su estado se obtiene reproduciendo
 * los pagos registrados (aplicar.ts).
 */

export type TipoCredito =
  | 'tarjeta' | 'consumo' | 'capital' | 'vehicular' | 'hipotecario' | 'garantia' | 'empresarial' | 'suscripcion';

export type FuenteAcreedor = 'tarjetas' | 'entidades' | 'empresas';

export const fuenteDe = (tipo: string): FuenteAcreedor =>
  tipo === 'tarjeta' ? 'tarjetas' : tipo === 'empresarial' || tipo === 'suscripcion' ? 'empresas' : 'entidades';

export const ETIQUETA_TIPO: Record<string, string> = {
  tarjeta: 'Tarjeta de crédito',
  consumo: 'Consumo',
  capital: 'Capital de trabajo',
  vehicular: 'Vehicular',
  hipotecario: 'Hipotecario',
  garantia: 'Garantía bancaria',
  empresarial: 'Crédito empresarial',
  suscripcion: 'Suscripción',
};

export type Accion = 'cuota' | 'parcial' | 'capital' | 'liq_capital' | 'liq_total';

export const ETIQUETA_ACCION: Record<Accion, string> = {
  cuota: 'Pago de cuota',
  parcial: 'Abono parcial',
  capital: 'Abono a capital',
  liq_capital: 'Liquidación por capital',
  liq_total: 'Liquidación total',
};

export type TipoCargo = 'cobranza' | 'multa' | 'comision' | 'otros';

export const ETIQUETA_CARGO: Record<TipoCargo, string> = {
  cobranza: 'Gestión de cobranza',
  multa: 'Multa / interés de mora',
  comision: 'Comisión bancaria',
  otros: 'Otros cargos',
};

export interface Partes {
  capital: number;
  interes: number;
  seguro: number;
  cargos?: number;
}

export interface CuotaMotor {
  n: number;
  fecha: string;
  capital: number;
  interes: number;
  seguro: number;
  cuota: number;
  saldo: number;
  liq?: boolean;
}

export interface ParamsAmort {
  tasa: number;
  inicio: string;
  desgTipo: string;
  desgVal: number;
  otrosSeg: number;
}

export type Modalidad = 'corriente' | 'dif_con' | 'dif_sin';

export interface ConsumoMotor {
  id: number;
  fecha: string;
  comercio: string;
  categoriaId: number | null;
  categoriaNombre: string | null;
  monto: number;
  mod: Modalidad;
  plazo: number;
  gracia: number;
  /** Período en que se precanceló el diferido (liquidación de la tarjeta). */
  liqPer?: string;
  liqMonto?: number;
}

export interface TarjetaMotor {
  id: number;
  nombre: string;
  emisor: string;
  entidadId: number;
  ult4: string | null;
  cupo: number;
  corte: number;
  diaPago: number;
  tasa: number;
  color: string | null;
  marca: string | null;
  propiedad: string | null;
}

export interface ResumenMotor {
  valor: number;
  fecha: string;
  minimo: number | null;
  saldo: number | null;
  restantes: number | null;
  tasa: number;
  abonado: number;
}

export interface Origen {
  cuentaId?: number | null;
  tarjetaId?: number | null;
  agencia?: string | null;
  tercero?: string | null;
  relacion?: string | null;
}

export interface Movimiento {
  id: number;
  fecha: string;
  accion: Accion;
  /** Total pagado, incluidos los cargos. */
  monto: number;
  fechaVence: string | null;
  clave: string | null;
  modoAbono: 'plazo' | 'cuota' | null;
  desc: string;
  medio: string;
  ref: string | null;
  origen: Origen | null;
  cats: Record<number, number> | null;
  cargos: Partial<Record<TipoCargo, number>> | null;
  partes: Partes;
  antes: { saldo: number; total: number } | null;
  despues: { saldo: number; total: number } | null;
}

export interface DeudaMotor {
  id: number;
  tipo: TipoCredito;
  modo: 'resumida' | 'detallada';
  fuente: FuenteAcreedor;
  alias: string | null;
  acreedorId: number | null;
  acreedorNombre: string;
  /** Subtipo del acreedor (Banco, Cooperativa…) para agrupar en reportes. */
  acreedorSubtipo: string | null;
  /** Entidad (banco) que emite: el acreedor, o el emisor si es tarjeta. */
  credNombre: string;
  credId: number | null;
  /** Sitio web y logo propio del acreedor/emisor (para el logo en la app). */
  credWeb: string | null;
  credLogo: string | null;
  tarjeta: TarjetaMotor | null;
  categoriaId: number | null;
  pagaCon: string | null;
  avisoDias: number;
  creado: string;
  estado: '' | 'pagada' | 'liquidada';
  amort: { params: ParamsAmort; rows: CuotaMotor[] } | null;
  /** Lo abonado a cada cuota de la tabla (n → monto). */
  pagosCuota: Record<number, number>;
  consumos: ConsumoMotor[];
  /** Lo pagado de cada estado de cuenta de la tarjeta (YYYY-MM → monto). */
  concil: Record<string, { pagado: number; fechaPago: string | null }>;
  res: ResumenMotor | null;
  liq: { fecha: string; tipo: Accion; monto: number } | null;
  movs: Movimiento[];
}

export interface Obligacion {
  deudaId: number;
  clave: string;
  fecha: string;
  total: number;
  pagado: number;
  monto: number;
  desc: string;
  partes: Partes;
  /** Cuotas diferidas de un período que todavía no se factura. */
  futura?: boolean;
  n?: number;
  per?: string;
}

export interface InfoDeuda {
  saldoCapital: number;
  totalPorPagar: number;
  interesPorPagar: number;
  segurosPorPagar: number;
  cuotasRest: number | 'Indefinida';
  cuotasTot: number | null;
  fin: string | null;
  tasa: number | null;
  liqCapital: number;
  liqDet: [string, number][];
  vencido: number;
}
