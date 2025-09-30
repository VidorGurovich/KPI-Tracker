/**
 * User Management Routes
 * Handles user profile management, password changes, and user administration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { UserManagementService } from '../../services/UserManagementService';
import { authMiddleware as authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const userService = new UserManagementService();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const profile = await userService.getUserProfile(userId);

    res.json({
      message: 'Profile retrieved successfully',
      user: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile', [
  authenticateToken,
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const updateData = req.body;

    const updatedProfile = userService.updateProfile(userId, updateData);

    res.json({
      message: 'Profile updated successfully',
      user: updatedProfile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/users
 * Get all users (admin/manager only)
 */
router.get('/', [
  authenticateToken,
  requireRole(['manager']),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search term must not be empty'),
  query('role')
    .optional()
    .isIn(['employee', 'manager'])
    .withMessage('Role must be employee or manager'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;

    const result = userService.getUsersPaginated(page, limit, {
      query: search,
      role: role as any
    });

    res.json({
      message: 'Users retrieved successfully',
      users: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * Get user by ID (admin/manager only)
 */
router.get('/:id', [
  authenticateToken,
  requireRole(['manager']),
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User with the specified ID does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'User retrieved successfully',
      user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/stats
 * Get user statistics (admin/manager only)
 */
router.get('/stats', [
  authenticateToken,
  requireRole(['manager']),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = userService.getUserStats();

    res.json({
      message: 'User statistics retrieved successfully',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };
