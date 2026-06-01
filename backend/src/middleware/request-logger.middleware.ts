import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Lightweight HTTP request/response logger (no morgan dep).
 * - Assigns/propagates an `x-request-id` for correlation.
 * - Logs method/path/status/latency on response finish; level by status class.
 */
export function requestLogger(req: RequestWithId, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = `[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${latencyMs.toFixed(1)}ms reqId=${requestId}`;
    if (res.statusCode >= 500) {
      logger.error(line);
    } else if (res.statusCode >= 400) {
      logger.warn(line);
    } else {
      logger.info(line);
    }
  });

  next();
}
