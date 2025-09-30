/**
 * Error Handler Middleware
 * Centralized error handling for the API
 */

import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle specific error types
  if (error.message.includes('not found')) {
    statusCode = 404;
  } else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
    statusCode = 409;
  } else if (error.message.includes('validation') || error.message.includes('invalid')) {
    statusCode = 400;
  } else if (error.message.includes('unauthorized') || error.message.includes('token')) {
    statusCode = 401;
  } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
    statusCode = 403;
  }

  // Don't expose internal errors in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    error: getErrorName(statusCode),
    message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

function getErrorName(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 409: return 'Conflict';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    default: return 'Error';
  }
}
