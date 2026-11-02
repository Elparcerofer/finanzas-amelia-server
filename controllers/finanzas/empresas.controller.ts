import { NextFunction, Request, Response } from 'express';
import {
  borrarEmpresa,
  editarEmpresa,
  obtenerEmpresa,
  obtenerEmpresas,
  registrarEmpresa,
} from '../../services/finanzas/empresas.service';

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerEmpresas());
  } catch (error) {
    next(error);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await obtenerEmpresa(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await registrarEmpresa(req.body));
  } catch (error) {
    next(error);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await editarEmpresa(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await borrarEmpresa(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
