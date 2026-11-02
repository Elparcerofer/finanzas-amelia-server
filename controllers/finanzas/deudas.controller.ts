import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  borrarDeuda,
  editarDeuda,
  obtenerDeuda,
  obtenerDeudasDeUsuario,
  registrarDeuda,
} from '../../services/finanzas/deudas.service';

export async function listar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerDeudasDeUsuario(req.usuario!.id));
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerDeuda(req.usuario!.id, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await registrarDeuda(req.usuario!.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await editarDeuda(req.usuario!.id, Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await borrarDeuda(req.usuario!.id, Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
