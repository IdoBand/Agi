import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { RequestWithId } from './request-logger.middleware.js';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const reqId = (req as RequestWithId).requestId;
  const tag = reqId ? ` reqId=${reqId}` : '';
  const line = `[error] ${statusCode} ${message}${tag} stack=${err.stack ?? '-'}`;

  if (statusCode >= 500) {
    logger.error(line);
  } else {
    logger.warn(line);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
