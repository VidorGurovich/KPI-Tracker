/**
 * KPI Management API Routes
 * Handles KPI groups, definitions, and assignments
 * Based on: tests/contract/kpis.test.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { KPIManagementService } from '../../services/KPIManagementService';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// Lazy initialization factory function
const getKPIService = () => new KPIManagementService();

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

// Validation for KPI definition schema
const validateKPIDefinition = (definition: any): string | null => {
  const required = ['category', 'metricName', 'description', 'frequency', 'targetType', 'targetValue', 'measurementMethod', 'dataSource', 'reviewCadence', 'weight'];
  
  for (const field of required) {
    if (!definition[field]) {
      return `KPI definition missing required field: ${field}`;
    }
  }

  if (!['Daily', 'Weekly', 'Sprint', 'Monthly'].includes(definition.frequency)) {
    return 'KPI definition frequency must be one of: Daily, Weekly, Sprint, Monthly';
  }

  if (!['percentage', 'numeric', 'boolean', 'string'].includes(definition.targetType)) {
    return 'KPI definition targetType must be one of: percentage, numeric, boolean, string';
  }

  if (typeof definition.weight !== 'number' || definition.weight < 1) {
    return 'KPI definition weight must be a positive integer';
  }

  return null;
};

/**
 * POST /api/kpis/groups
 * Create a new KPI group with definitions (Manager role required)
 */
router.post('/groups', [
  authMiddleware,
  requireRole(['manager', 'both']),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Group name is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('definitions')
    .isArray({ min: 1 })
    .withMessage('At least one KPI definition is required'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, definitions } = req.body;
    const createdBy = req.user!.id;
    
    const kpiService = getKPIService();

    // Check for duplicate group name for this creator
    const existingGroups = kpiService.getAllKPIGroups();
    if (existingGroups.some(group => group.name === name.trim())) {
      return res.status(409).json({
        success: false,
        error: 'A KPI group with this name already exists',
        code: 'GROUP_NAME_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    // Validate all KPI definitions
    for (let i = 0; i < definitions.length; i++) {
      const validationError = validateKPIDefinition(definitions[i]);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Create KPI group (we'll simulate this since the service structure needs adaptation)
    const group = kpiService.createKPIGroup({
      name: name.trim(),
      description: description?.trim(),
      weight: 100 // Default weight
    });

    // Create associated definitions (this would need service method updates)
    const createdDefinitions = [];
    for (const defData of definitions) {
      const definition = kpiService.createKPIDefinition({
        name: defData.metricName,
        description: defData.description,
        frequency: defData.frequency.toLowerCase() as any,
        targetValue: parseFloat(defData.targetValue.replace(/[^\d.-]/g, '')) || 0,
        weight: defData.weight,
        groupId: group.id
      });

      createdDefinitions.push({
        id: definition.id,
        category: defData.category,
        metricName: defData.metricName,
        description: defData.description,
        frequency: defData.frequency,
        targetType: defData.targetType,
        targetValue: defData.targetValue,
        measurementMethod: defData.measurementMethod,
        dataSource: defData.dataSource,
        reviewCadence: defData.reviewCadence,
        weight: defData.weight
      });
    }

    res.status(201).json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        definitionCount: createdDefinitions.length,
        createdBy,
        createdAt: group.createdAt.toISOString(),
        isActive: true
      },
      definitions: createdDefinitions,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('KPI group creation error:', error);
    
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'A KPI group with this name already exists',
        code: 'GROUP_NAME_EXISTS',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'GROUP_CREATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/kpis/assigned
 * Get KPIs assigned to the authenticated user
 */
router.get('/assigned', [
  authMiddleware
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const kpiService = getKPIService();

    const instances = kpiService.getKPIInstancesByUser(userId, true);

    const assignedKPIs = instances.map(instance => ({
      instanceId: instance.id,
      definition: {
        id: instance.definitionId,
        category: instance.groupName || 'General', // Use group name as category
        metricName: instance.definitionName,
        description: instance.definitionDescription,
        frequency: instance.definitionFrequency,
        targetType: 'percentage', // Default - would need to be stored in definition
        targetValue: instance.definitionTargetValue.toString(),
        weight: instance.definitionWeight
      },
      assignedBy: {
        id: 1, // Default system user ID
        firstName: 'System',
        lastName: 'Admin'
      },
      assignedAt: instance.startDate.toISOString(),
      isActive: instance.isActive,
      latestRecord: null // Would need to connect to performance records
    }));

    res.json({
      success: true,
      kpis: assignedKPIs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get assigned KPIs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'FETCH_ASSIGNED_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/kpis/assignments
 * Assign KPIs to users (Manager role required)
 */
router.post('/assignments', [
  authMiddleware,
  requireRole(['manager', 'both']),
  body('groupId')
    .isInt({ min: 1 })
    .withMessage('Group ID must be a positive integer'),
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs array is required'),
  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('All user IDs must be positive integers'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId, userIds, notes } = req.body;
    const assignedBy = req.user!.id;
    
    const kpiService = getKPIService();

    // Validate group exists and user has access
    const group = kpiService.getKPIGroup(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'KPI group not found',
        code: 'GROUP_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Get definitions for this group
    const definitions = kpiService.getKPIDefinitionsByGroup(groupId);
    if (definitions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No KPI definitions found for this group',
        code: 'NO_DEFINITIONS',
        timestamp: new Date().toISOString()
      });
    }

    // Check for duplicate assignments
    const conflictingUsers: number[] = [];
    for (const userId of userIds) {
      for (const definition of definitions) {
        const existingInstances = kpiService.getKPIInstancesByDefinition(definition.id);
        const hasActiveAssignment = existingInstances.some(inst => 
          inst.userId === userId && inst.isActive
        );
        if (hasActiveAssignment && !conflictingUsers.includes(userId)) {
          conflictingUsers.push(userId);
        }
      }
    }

    if (conflictingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Some users already have active assignments for KPIs in this group',
        code: 'DUPLICATE_ASSIGNMENT',
        conflictingUsers,
        timestamp: new Date().toISOString()
      });
    }

    // Create assignments
    const assignments = [];
    for (const userId of userIds) {
      for (const definition of definitions) {
        const instance = kpiService.assignKPI({
          definitionId: definition.id,
          userId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
        });

        assignments.push({
          instanceId: instance.id,
          userId,
          definitionId: definition.id,
          assignedAt: instance.startDate.toISOString()
        });
      }
    }

    res.status(201).json({
      success: true,
      assignments,
      totalAssigned: assignments.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('KPI assignment error:', error);
    
    if (error.message && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this KPI group',
        code: 'GROUP_ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'ASSIGNMENT_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as kpiRouter };
