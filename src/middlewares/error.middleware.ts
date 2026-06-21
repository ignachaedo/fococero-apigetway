import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';
  
  if (!err.isOperational) {
    logger.error({ err }, '[ERROR] Unexpected error:');
  }
  
  res.status(statusCode).json({
    ok: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
