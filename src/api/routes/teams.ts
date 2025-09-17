/**
 * Team Management Routes
 * Simplified team routes using UserManagementService
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
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
 * GET /api/teams/members/:managerId
 * Get team members for a manager
 */
router.get('/members/:managerId', [
  authenticateToken,
  requireRole(['manager']),
  param('managerId')
    .isInt({ min: 1 })
    .withMessage('Manager ID must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const managerId = parseInt(req.params.managerId);
    const currentUserId = req.user!.id;
    
    // Only allow managers to view their own team members or other managers to view any
    if (currentUserId !== managerId && req.user!.role !== 'manager') {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only view your own team members',
        timestamp: new Date().toISOString()
      });
    }

    const members = userService.getTeamMembers(managerId);

    res.json({
      message: 'Team members retrieved successfully',
      members,
      managerId,
      memberCount: members.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/my-members
 * Get current manager's team members
 */
router.get('/my-members', [
  authenticateToken,
  requireRole(['manager'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const managerId = req.user!.id;
    const members = userService.getTeamMembers(managerId);

    res.json({
      message: 'Your team members retrieved successfully',
      members,
      managerId,
      memberCount: members.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/unassigned
 * Get employees not assigned to any team (manager only)
 */
router.get('/unassigned', [
  authenticateToken,
  requireRole(['manager'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unassignedEmployees = userService.getUnassignedEmployees();

    res.json({
      message: 'Unassigned employees retrieved successfully',
      employees: unassignedEmployees,
      count: unassignedEmployees.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as teamRouter };
