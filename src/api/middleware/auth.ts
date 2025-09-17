/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../../services/AuthenticationService';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: 'employee' | 'manager' | 'both';
        firstName: string;
        lastName: string;
      };
    }
  }
}

const authService = new AuthenticationService();

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

    // Validate token and get user data
    const tokenPayload = authService.validateToken(token);
    
    // Get additional user details
    const userService = new (await import('../../services/UserManagementService')).UserManagementService();
    const userDetails = userService.getUserById(tokenPayload.userId);
    
    if (!userDetails) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Attach user to request
    req.user = {
      id: tokenPayload.userId,
      email: tokenPayload.email,
      role: tokenPayload.role as 'employee' | 'manager' | 'both',
      firstName: userDetails.firstName,
      lastName: userDetails.lastName
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

    const userRole = req.user.role;
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
