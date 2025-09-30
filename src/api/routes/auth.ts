/**
 * Authentication Routes
 * Handles user registration, login, email verification, and password reset
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticationService } from '../../services/AuthenticationService';

const router = Router();

// Simple test route to verify router is working
router.get('/test', (req: Request, res: Response) => {
  console.log('✅ Auth test route hit!');
  res.json({ message: 'Auth router is working!', timestamp: new Date().toISOString() });
});

console.log('🔄 Auth routes module loading...');

// Lazy initialization factory function
const getAuthService = () => {
  try {
    return new AuthenticationService({
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
      passwordResetTokenExpiresIn: '1h',
      emailVerificationTokenExpiresIn: '24h'
    });
  } catch (error: any) {
    console.error('❌ Error creating AuthenticationService:', error);
    throw error;
  }
};

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: firstError.msg,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters with complexity requirements')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('password must contain uppercase, lowercase, number, and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('role')
    .isIn(['employee', 'manager', 'both'])
    .withMessage('role must be employee, manager, or both'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    const authService = getAuthService();
    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      role
    });

    res.status(201).json({
      success: true,
      message: result.message,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        emailVerified: result.user.emailVerified
      },
      verificationRequired: result.verificationRequired,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle specific registration errors
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    const authService = getAuthService();
    const result = await authService.login({ email, password });

    res.json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        emailVerified: result.user.emailVerified
      },
      expiresIn: result.expiresIn,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle specific authentication errors
    if (error.message && error.message.includes('Invalid credentials')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.message && error.message.includes('verify')) {
      return res.status(401).json({
        success: false,
        error: 'Please verify your email before logging in',
        code: 'EMAIL_NOT_VERIFIED',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify email address with verification token
 */
router.post('/verify', [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    const authService = getAuthService();
    const result = await authService.verifyEmail(token);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        code: 'INVALID_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: result.message,
      user: result.user ? {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        emailVerified: result.user.emailVerified
      } : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset token
 */
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    const authService = getAuthService();
    const result = await authService.requestPasswordReset({ email });

    res.json({
      message: result.message,
      success: result.success,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with reset token
 */
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    
    const authService = getAuthService();
    const result = await authService.confirmPasswordReset({ token, newPassword });

    if (!result.success) {
      return res.status(400).json({
        error: 'Password Reset Failed',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: result.message,
      success: result.success,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    const authService = getAuthService();
    const result = await authService.refreshToken({ refreshToken });

    res.json({
      message: 'Token refreshed successfully',
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        emailVerified: result.user.emailVerified
      },
      expiresIn: result.expiresIn,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

console.log('🔄 Auth routes exported, route stack:', router.stack?.length || 0);

export { router as authRouter };
