import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  editarIngreso,
  obtenerIngreso,
  obtenerIngresosDeUsuario,
  registrarIngreso,
  removerIngreso,
} from '../../services/finanzas/ingresos.service';

export async function listar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ingresos = await obtenerIngresosDeUsuario(req.usuario!.id);
    res.json(ingresos);
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ingreso = await obtenerIngreso(Number(req.params.id));
    res.json(ingreso);
  } catch (error) {
    next(error);
  }
}

export async function crear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ingreso = await registrarIngreso(req.usuario!.id, req.body);
    res.status(201).json(ingreso);
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ingreso = await editarIngreso(Number(req.params.id), req.body);
    res.json(ingreso);
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await removerIngreso(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
