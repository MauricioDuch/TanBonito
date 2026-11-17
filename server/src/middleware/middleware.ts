import { Request, Response, NextFunction, RequestHandler } from 'express';
import { StockError } from '../config/stock.js';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.userId) next();
  else res.status(401).json({ error: 'No autorizado' });
};

// Express 5 ya captura errores de handlers async; esto solo tipa y deja un único lugar para cambiarlo
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof StockError && !res.headersSent) return res.status(409).json({ error: err.message });
  console.error(`Error en ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  if (err?.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(409).json({ error: 'El stock no puede quedar negativo' });
  }
  // Borrar algo que está en uso (p. ej. un insumo usado en una receta)
  if (err?.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'No se puede borrar: está en uso en otros registros' });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
};

// Validación mínima de body: devuelve el primer campo faltante
export const missing = (body: any, fields: string[]) =>
  fields.find((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === '');
