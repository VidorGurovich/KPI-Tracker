/**
 * Shared Authentication Types
 * Common interfaces for authentication across all middleware systems
 */

import { TokenPayload } from '../services/AuthenticationService';

// Enhanced user interface that extends TokenPayload with compatibility fields
export interface AuthUser extends TokenPayload {
  id: number; // Alias for userId to maintain compatibility with existing routes
}

// Global Express Request extension
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
