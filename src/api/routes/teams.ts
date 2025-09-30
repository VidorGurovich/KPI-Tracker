/**
 * Teams Management API Routes
 * Handles team creation, member management, and team information retrieval
 * Based on: tests/contract/teams.test.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { TeamModel } from '../../models/Team';
import { UserModel } from '../../models/User';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// Lazy initialization factory functions
const getTeamModel = () => new TeamModel();
const getUserModel = () => new UserModel();

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
 * POST /api/teams
 * Create a new team (Manager role required)
 */
router.post('/', [
  authMiddleware,
  requireRole(['manager', 'both']),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Team name is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('memberIds')
    .isArray({ min: 0 })
    .withMessage('memberIds must be an array'),
  body('memberIds.*')
    .isInt({ min: 1 })
    .withMessage('All member IDs must be positive integers'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, memberIds } = req.body;
    const managerId = req.user!.id;
    
    const teamModel = getTeamModel();
    const userModel = getUserModel();

    // Check for duplicate team name for this manager
    if (teamModel.findByNameAndManager(name.trim(), managerId)) {
      return res.status(409).json({
        success: false,
        error: 'A team with this name already exists',
        code: 'TEAM_NAME_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    // Validate all member IDs exist and are employees
    if (memberIds && memberIds.length > 0) {
      const invalidIds: number[] = [];
      
      for (const memberId of memberIds) {
        const user = userModel.findById(memberId);
        if (!user) {
          invalidIds.push(memberId);
        } else if (user.role !== 'employee' && user.role !== 'both') {
          invalidIds.push(memberId);
        }
      }

      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Some users are not registered employees',
          code: 'INVALID_MEMBERS',
          invalidIds,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Create team
    const team = teamModel.create({
      name: name.trim(),
      description: description?.trim() || undefined,
      managerId,
      memberIds: memberIds || []
    });

    res.status(201).json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        managerId: team.managerId,
        memberCount: team.memberCount,
        createdAt: team.createdAt.toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Team creation error:', error);
    
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'A team with this name already exists',
        code: 'TEAM_NAME_EXISTS',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'TEAM_CREATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/teams/managed
 * Get all teams managed by the authenticated user
 */
router.get('/managed', [
  authMiddleware,
  requireRole(['manager', 'both'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const managerId = req.user!.id;
    const teamModel = getTeamModel();

    const teams = teamModel.findByManager(managerId);

    res.json({
      success: true,
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        managerId: team.managerId,
        memberCount: team.memberCount,
        createdAt: team.createdAt.toISOString()
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get managed teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'FETCH_TEAMS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/teams/{id}/members
 * Get team members with role information
 */
router.get('/:id/members', [
  authMiddleware,
  param('id')
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    const teamModel = getTeamModel();

    // Check if team exists
    const team = teamModel.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Check access permissions
    const hasAccess = 
      team.managerId === userId || // User is the manager
      userRole === 'manager' || userRole === 'both' || // User is a manager
      teamModel.isMember(teamId, userId); // User is a team member

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this team',
        code: 'TEAM_ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    // Get team members with details
    const members = teamModel.getMembers(teamId);

    res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        managerId: team.managerId
      },
      members: members.map(member => ({
        id: member.user.id,
        email: member.user.email,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        role: member.user.role,
        joinedAt: member.joinedAt.toISOString(),
        roleInTeam: member.user.id === team.managerId ? 'manager' : 'member'
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'FETCH_MEMBERS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as teamRouter };
