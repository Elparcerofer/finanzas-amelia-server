import { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({ msg: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

/** Formato de error `{ msg }` — es lo que ApiClientFinanzas._handleResponse busca en el body. */
export function errorMiddleware(err: HttpError | Error, req: Request, res: Response, next: NextFunction): void {
  // Errores de Express/body-parser traen su código (413 cuerpo muy grande, 400 JSON inválido…).
  const deExpress = (err as { status?: unknown }).status;
  const status = err instanceof HttpError ? err.status : typeof deExpress === 'number' && deExpress >= 400 ? deExpress : 500;
  const msg =
    status === 413 ? 'El archivo es demasiado grande' : status === 500 ? 'Error interno del servidor' : err.message || 'Error interno del servidor';

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ msg });
}
