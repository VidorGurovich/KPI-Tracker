/**
 * Request Logger Middleware
 * Logs incoming requests for debugging and monitoring
 */

import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log the request
  console.log(`➡️  ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response time
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
    
    console.log(`⬅️  ${statusColor} ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`);
    
    return originalEnd(chunk, encoding, cb);
  };

  next();
};
