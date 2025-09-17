/**
 * Authentication Middleware
 * JWT token validation and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../../services/AuthenticationService';
import '../../types/auth'; // Import shared auth types

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    req.user = {
      ...decoded,
      id: decoded.userId // Map userId to id for compatibility
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
    return;
  }
};

/**
 * Middleware to require specific roles
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_USER'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLE'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to require manager role specifically
 */
export const requireManager = requireRole(['manager', 'both']);

/**
 * Middleware to require employee role specifically  
 */
export const requireEmployee = requireRole(['employee', 'both']);

/**
 * Optional authentication - adds user to request if token is valid, but doesn't reject if missing
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    req.user = {
      ...decoded,
      id: decoded.userId // Map userId to id for compatibility
    };
  } catch (error) {
    // Ignore token errors for optional auth
    console.warn('Optional auth token error:', error);
  }

  next();
};
