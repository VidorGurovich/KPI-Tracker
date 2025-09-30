/**
 * Authentication API Routes
 * RESTful endpoints for user registration, login, and verification
 * Based on: specs/001-kpi-tracker-with/contracts/auth.md
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { AuthenticationService } from '../../services/AuthenticationService';
import { UserModel } from '../../models/User';

const router = Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 registration attempts per hour
  message: {
    success: false,
    error: 'Too many registration attempts, please try again later.',
    code: 'REGISTRATION_RATE_LIMIT'
  }
});

// Service factory functions (lazy initialization after database is ready)
const getUserModel = () => new UserModel();
const getAuthService = () => new AuthenticationService({
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  jwtExpiresIn: '24h',
  refreshTokenExpiresIn: '7d',
  passwordResetTokenExpiresIn: '1h',
  emailVerificationTokenExpiresIn: '24h'
});

// Validation middleware
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required (max 100 characters)'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required (max 100 characters)'),
  body('role')
    .isIn(['employee', 'manager', 'both'])
    .withMessage('Role must be employee, manager, or both')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const verifyValidation = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
];

/**
 * POST /api/auth/register
 * Register new user with email verification
 */
router.post('/register', registerLimiter, registerValidation, async (req: Request, res: Response) => {
  try {
    // Check validation errors  
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', '),
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password, firstName, lastName, role } = req.body;

    // Check if user already exists
    const userModel = getUserModel();
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Register user
    const authService = getAuthService();
    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      role
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      user: result.user
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during registration',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', authLimiter, loginValidation, async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', '),
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password } = req.body;

    // Attempt login
    const authService = getAuthService();
    const result = await authService.login({ email, password });

    return res.status(200).json({
      success: true,
      token: result.token,
      expiresIn: result.expiresIn,
      user: result.user
    });

  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle specific authentication errors
    if (error.message?.includes('Invalid credentials')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    if (error.message?.includes('not verified')) {
      return res.status(401).json({
        success: false,
        error: 'Please verify your email before logging in',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error during login',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify user email with verification token
 */
router.post('/verify', verifyValidation, async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', '),
        code: 'VALIDATION_ERROR'
      });
    }

    const { token } = req.body;

    // Verify email
    const authService = getAuthService();
    const result = await authService.verifyEmail(token);

    return res.status(200).json({
      success: true,
      message: 'Email successfully verified',
      user: result.user
    });

  } catch (error: any) {
    console.error('Email verification error:', error);
    
    // Handle specific verification errors
    if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error during verification',
      code: 'VERIFICATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', '),
        code: 'VALIDATION_ERROR'
      });
    }

    const { email } = req.body;

    const authService = getAuthService();
    await authService.requestPasswordReset({ email });

    // Always return success for security (don't leak email existence)
    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', authLimiter, [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array().map(err => err.msg).join(', '),
        code: 'VALIDATION_ERROR'
      });
    }

    const { token, newPassword } = req.body;

    const authService = getAuthService();
    await authService.confirmPasswordReset({ token, newPassword });

    return res.status(200).json({
      success: true,
      message: 'Password successfully reset'
    });

  } catch (error: any) {
    console.error('Password reset error:', error);
    
    if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error during password reset',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

export default router;
