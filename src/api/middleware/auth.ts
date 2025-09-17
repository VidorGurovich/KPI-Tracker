/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService, TokenPayload } from '../../services/AuthenticationService';
import '../../types/auth'; // Import shared auth types

// Lazy initialization factory functions
const getAuthService = () => new AuthenticationService({
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  jwtExpiresIn: '24h',
  refreshTokenExpiresIn: '7d',
  passwordResetTokenExpiresIn: '1h',
  emailVerificationTokenExpiresIn: '24h'
});

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate token and get user payload directly
    const authService = getAuthService();
    const tokenPayload = authService.validateToken(token);
    
    if (!tokenPayload) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token or user not found',
        timestamp: new Date().toISOString()
      });
    }

    // Attach user to request with compatibility mapping
    req.user = {
      ...tokenPayload,
      id: tokenPayload.userId // Map userId to id for API route compatibility
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: ('employee' | 'manager' | 'both')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    const userRole = req.user.role as 'employee' | 'manager' | 'both';
    const hasAccess = allowedRoles.includes(userRole) || 
                     (userRole === 'both' && (allowedRoles.includes('manager') || allowedRoles.includes('employee')));

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Manager-only access middleware
 */
export const requireManager = requireRole(['manager', 'both']);

/**
 * Employee access middleware (includes managers with 'both' role)
 */
export const requireEmployee = requireRole(['employee', 'both']);
