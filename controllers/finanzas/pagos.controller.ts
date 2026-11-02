import { NextFunction, Request, Response } from 'express';
import { obtenerPago, obtenerPagosDeDeuda, registrarPago, removerPago } from '../../services/finanzas/pagos.service';

export async function listarPorDeuda(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagos = await obtenerPagosDeDeuda(Number(req.params.deudaId));
    res.json(pagos);
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pago = await obtenerPago(Number(req.params.id));
    res.json(pago);
  } catch (error) {
    next(error);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pago = await registrarPago(req.body);
    res.status(201).json(pago);
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await removerPago(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
