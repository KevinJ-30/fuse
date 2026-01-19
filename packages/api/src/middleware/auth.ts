import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Simple API key authentication for MVP
// In production, use proper JWT or OAuth
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    logger.warn({ path: req.path }, 'Missing API key');
    return res.status(401).json({
      status: 'error',
      message: 'API key required'
    });
  }

  // For MVP, accept any non-empty API key
  // In production, validate against database
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    logger.warn({ path: req.path }, 'Invalid API key');
    return res.status(401).json({
      status: 'error',
      message: 'Invalid API key'
    });
  }

  // Attach to request for later use
  (req as any).apiKey = apiKey;
  next();
}
