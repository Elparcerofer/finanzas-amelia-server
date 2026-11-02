import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  borrarTarjeta,
  editarTarjeta,
  obtenerTarjeta,
  obtenerTarjetas,
  registrarTarjeta,
} from '../../services/finanzas/tarjetas.service';

export async function listar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerTarjetas(req.usuario!.id));
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerTarjeta(req.usuario!.id, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await registrarTarjeta(req.usuario!.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await editarTarjeta(req.usuario!.id, Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await borrarTarjeta(req.usuario!.id, Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
