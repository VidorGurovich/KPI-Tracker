/**
 * Teams API Routes
 * RESTful endpoints for team management and member operations
 * Based on: specs/001-kpi-tracker-with/contracts/teams.md
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { TeamModel } from '../../models/Team';
import { UserModel } from '../../models/User';
import { authMiddleware, requireRole } from '../../api/middleware/auth';

const router = Router();

// Model factory functions (lazy initialization after database is ready)
const getTeamModel = () => new TeamModel();
const getUserModel = () => new UserModel();

// Validation middleware
const createTeamValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Team name is required (max 255 characters)'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('memberIds')
    .isArray({ min: 0 })
    .withMessage('memberIds must be an array')
    .custom((memberIds) => {
      if (!Array.isArray(memberIds)) return false;
      return memberIds.every(id => Number.isInteger(id) && id > 0);
    })
    .withMessage('All member IDs must be positive integers')
];

const teamIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer')
];

const addMembersValidation = [
  body('memberIds')
    .isArray({ min: 1 })
    .withMessage('memberIds must be a non-empty array')
    .custom((memberIds) => {
      if (!Array.isArray(memberIds)) return false;
      return memberIds.every(id => Number.isInteger(id) && id > 0);
    })
    .withMessage('All member IDs must be positive integers')
];

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * POST /api/teams
 * Create new team with selected employees (Manager only)
 */
router.post('/', requireRole(['manager', 'both']), createTeamValidation, async (req: Request, res: Response) => {
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

    const { name, description, memberIds = [] } = req.body;
    const managerId = (req as any).user.userId;

    // Initialize models
    const teamModel = getTeamModel();
    const userModel = getUserModel();

    // Check if team name already exists for this manager
    const existingTeam = teamModel.findByNameAndManager(name, managerId);
    if (existingTeam) {
      return res.status(409).json({
        success: false,
        error: 'A team with this name already exists',
        code: 'TEAM_NAME_EXISTS'
      });
    }

    // Validate all member IDs exist and are employees
    if (memberIds.length > 0) {
      const invalidIds: number[] = [];
      for (const memberId of memberIds) {
        const user = await userModel.findById(memberId);
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
          invalidIds
        });
      }
    }

    // Create team
    const team = teamModel.create({
      name: name.trim(),
      description: description?.trim() || undefined,
      managerId,
      memberIds
    });

    return res.status(201).json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        managerId: team.managerId,
        memberCount: team.memberCount,
        createdAt: team.createdAt
      }
    });

  } catch (error) {
    console.error('Team creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during team creation',
      code: 'TEAM_CREATION_ERROR'
    });
  }
});

/**
 * GET /api/teams/managed
 * Get all teams managed by the authenticated user
 */
router.get('/managed', requireRole(['manager', 'both']), async (req: Request, res: Response) => {
  try {
    const managerId = (req as any).user.userId;

    // Initialize models
    const teamModel = getTeamModel();

    // Get teams with details
    const teams = teamModel.findByManager(managerId);

    return res.status(200).json({
      success: true,
      teams: teams.map((team: any) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        managerId: team.managerId,
        memberCount: team.memberCount,
        createdAt: team.createdAt
      }))
    });

  } catch (error) {
    console.error('Get managed teams error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching teams',
      code: 'FETCH_TEAMS_ERROR'
    });
  }
});

/**
 * GET /api/teams/:id/members
 * Get team members with role information
 */
router.get('/:id/members', teamIdValidation, async (req: Request, res: Response) => {
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

    const teamId = parseInt(req.params.id);
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    // Initialize models
    const teamModel = getTeamModel();

    // Check if team exists
    const team = await teamModel.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    // Check access permissions
    const hasAccess = 
      team.managerId === userId || // User is the manager
      userRole === 'manager' || userRole === 'both' || // User is a manager
      await teamModel.isMember(teamId, userId); // User is a team member

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this team',
        code: 'ACCESS_DENIED'
      });
    }

    // Get team members with details
    const members = await teamModel.getMembers(teamId);

    return res.status(200).json({
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
        joinedAt: member.joinedAt,
        roleInTeam: member.user.id === team.managerId ? 'manager' : 'member'
      }))
    });

  } catch (error) {
    console.error('Get team members error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching team members',
      code: 'FETCH_MEMBERS_ERROR'
    });
  }
});

/**
 * POST /api/teams/:id/members
 * Add members to a team (Manager only)
 */
router.post('/:id/members', requireRole(['manager', 'both']), teamIdValidation, addMembersValidation, async (req: Request, res: Response) => {
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

    const teamId = parseInt(req.params.id);
    const { memberIds } = req.body;
    const managerId = (req as any).user.userId;

    // Initialize models
    const teamModel = getTeamModel();
    const userModel = getUserModel();

    // Check if team exists and user is the manager
    const team = await teamModel.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    if (team.managerId !== managerId) {
      return res.status(403).json({
        success: false,
        error: 'Only the team manager can add members',
        code: 'ACCESS_DENIED'
      });
    }

    // Validate all member IDs exist and are employees
    const invalidIds: number[] = [];
    const alreadyMembers: number[] = [];

    for (const memberId of memberIds) {
      const user = await userModel.findById(memberId);
      if (!user) {
        invalidIds.push(memberId);
      } else if (user.role !== 'employee' && user.role !== 'both') {
        invalidIds.push(memberId);
      } else if (await teamModel.isMember(teamId, memberId)) {
        alreadyMembers.push(memberId);
      }
    }

    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some users are not registered employees',
        code: 'INVALID_MEMBERS',
        invalidIds
      });
    }

    if (alreadyMembers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Some users are already team members',
        code: 'ALREADY_MEMBERS',
        duplicateIds: alreadyMembers
      });
    }

    // Add members
    const newMemberIds = memberIds.filter((id: number) => !alreadyMembers.includes(id));
    if (newMemberIds.length > 0) {
      await teamModel.addMembers(teamId, newMemberIds);
    }

    // Get updated team with member count
    const updatedTeam = teamModel.findById(teamId);

    return res.status(200).json({
      success: true,
      message: `Successfully added ${newMemberIds.length} member(s) to the team`,
      team: {
        id: updatedTeam!.id,
        name: updatedTeam!.name,
        memberCount: updatedTeam!.memberCount
      }
    });

  } catch (error) {
    console.error('Add team members error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while adding team members',
      code: 'ADD_MEMBERS_ERROR'
    });
  }
});

/**
 * DELETE /api/teams/:id/members/:memberId
 * Remove a member from a team (Manager only)
 */
router.delete('/:id/members/:memberId', requireRole(['manager', 'both']), teamIdValidation, [
  param('memberId').isInt({ min: 1 }).withMessage('Member ID must be a positive integer')
], async (req: Request, res: Response) => {
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

    const teamId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId);
    const managerId = (req as any).user.userId;

    // Initialize models
    const teamModel = getTeamModel();

    // Check if team exists and user is the manager
    const team = await teamModel.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }

    if (team.managerId !== managerId) {
      return res.status(403).json({
        success: false,
        error: 'Only the team manager can remove members',
        code: 'ACCESS_DENIED'
      });
    }

    // Check if user is a member
    if (!(await teamModel.isMember(teamId, memberId))) {
      return res.status(404).json({
        success: false,
        error: 'User is not a member of this team',
        code: 'NOT_A_MEMBER'
      });
    }

    // Remove member
    await teamModel.removeMember(teamId, memberId);

    return res.status(200).json({
      success: true,
      message: 'Member successfully removed from team'
    });

  } catch (error) {
    console.error('Remove team member error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while removing team member',
      code: 'REMOVE_MEMBER_ERROR'
    });
  }
});

export default router;
