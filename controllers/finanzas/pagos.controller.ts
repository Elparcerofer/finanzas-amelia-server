import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { obtenerPago, obtenerPagosDeDeuda, registrarPago, removerPago } from '../../services/finanzas/pagos.service';

export async function listarPorDeuda(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagos = await obtenerPagosDeDeuda(req.usuario!.id, Number(req.params.deudaId));
    res.json(pagos);
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const pago = await obtenerPago(req.usuario!.id, Number(req.params.id));
    res.json(pago);
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const pago = await registrarPago(req.usuario!.id, req.body);
    res.status(201).json(pago);
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await removerPago(req.usuario!.id, Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
