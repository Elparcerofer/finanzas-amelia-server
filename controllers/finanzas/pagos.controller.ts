import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  anularPago,
  listarHistorial,
  listarPendientes,
  obtenerDetalle,
  opcionesPago,
  registrarPago,
  simularAbonoCapital,
} from '../../services/finanzas/pagos.service';

type Handler = (req: AuthRequest, res: Response) => Promise<void>;

/** Envuelve el handler para mandar los errores al errorMiddleware. */
const manejar = (h: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => h(req, res).catch(next);

export const pendientes = manejar(async (req, res) => {
  res.json(await listarPendientes(req.usuario!.id));
});

export const historial = manejar(async (req, res) => {
  res.json(await listarHistorial(req.usuario!.id));
});

export const opciones = manejar(async (req, res) => {
  res.json(await opcionesPago(req.usuario!.id));
});

export const detalleDeuda = manejar(async (req, res) => {
  res.json(await obtenerDetalle(req.usuario!.id, Number(req.params.deudaId)));
});

export const simularAbono = manejar(async (req, res) => {
  const { monto, modo } = req.query as unknown as { monto: number; modo: 'plazo' | 'cuota' };
  res.json(await simularAbonoCapital(req.usuario!.id, Number(req.params.deudaId), Number(monto), modo));
});

export const registrar = manejar(async (req, res) => {
  res.status(201).json(await registrarPago(req.usuario!.id, req.body));
});

export const anular = manejar(async (req, res) => {
  res.json(await anularPago(req.usuario!.id, Number(req.params.id), req.body?.motivo || null));
});
