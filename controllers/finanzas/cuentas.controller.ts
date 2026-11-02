import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  borrarCuenta,
  editarCuenta,
  obtenerCuenta,
  obtenerCuentas,
  registrarCuenta,
} from '../../services/finanzas/cuentas.service';

export async function listar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerCuentas(req.usuario!.id));
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerCuenta(req.usuario!.id, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await registrarCuenta(req.usuario!.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await editarCuenta(req.usuario!.id, Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await borrarCuenta(req.usuario!.id, Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
