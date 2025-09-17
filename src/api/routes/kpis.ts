/**
 * KPI Management Routes
 * Handles KPI definitions, instances, and performance tracking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { KPIManagementService } from '../../services/KPIManagementService';
import { authMiddleware as authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const kpiService = new KPIManagementService();

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
 * GET /api/kpis/definitions
 * Get all KPI definitions
 */
router.get('/definitions', [
  authenticateToken,
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Category must not be empty'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search term must not be empty'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string;
    const search = req.query.search as string;

    let definitions = kpiService.getAllKPIDefinitions();

    // Apply search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      definitions = definitions.filter(def => 
        def.name.toLowerCase().includes(searchTerm) ||
        (def.description && def.description.toLowerCase().includes(searchTerm))
      );
    }

    res.json({
      message: 'KPI definitions retrieved successfully',
      definitions,
      count: definitions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kpis/definitions
 * Create a new KPI definition (manager only)
 */
router.post('/definitions', [
  authenticateToken,
  requireRole(['manager']),
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('KPI name is required and must be less than 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description is required and must be less than 1000 characters'),
  body('category')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category is required and must be less than 100 characters'),
  body('unit')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Unit is required and must be less than 50 characters'),
  body('targetOperator')
    .isIn(['>=', '<=', '=', '>', '<'])
    .withMessage('Target operator must be one of: >=, <=, =, >, <'),
  body('frequency')
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Frequency must be one of: daily, weekly, monthly, quarterly, yearly'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kpiData = req.body;
    
    const definition = kpiService.createKPIDefinition(kpiData);

    res.status(201).json({
      message: 'KPI definition created successfully',
      definition,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpis/definitions/:id
 * Get KPI definition by ID
 */
router.get('/definitions/:id', [
  authenticateToken,
  param('id')
    .isInt({ min: 1 })
    .withMessage('KPI definition ID must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const definitionId = parseInt(req.params.id);
    
    const definition = kpiService.getKPIDefinition(definitionId);

    if (!definition) {
      return res.status(404).json({
        error: 'KPI Definition Not Found',
        message: 'KPI definition with the specified ID does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'KPI definition retrieved successfully',
      definition,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/kpis/definitions/:id
 * Update KPI definition (manager only)
 */
router.put('/definitions/:id', [
  authenticateToken,
  requireRole(['manager']),
  param('id')
    .isInt({ min: 1 })
    .withMessage('KPI definition ID must be a positive integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('KPI name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),
  body('unit')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Unit must be between 1 and 50 characters'),
  body('targetOperator')
    .optional()
    .isIn(['>=', '<=', '=', '>', '<'])
    .withMessage('Target operator must be one of: >=, <=, =, >, <'),
  body('frequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Frequency must be one of: daily, weekly, monthly, quarterly, yearly'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const definitionId = parseInt(req.params.id);
    const updateData = req.body;

    const updatedDefinition = kpiService.updateKPIDefinition(definitionId, updateData);

    if (!updatedDefinition) {
      return res.status(404).json({
        error: 'KPI Definition Not Found',
        message: 'KPI definition with the specified ID does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'KPI definition updated successfully',
      definition: updatedDefinition,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpis/instances
 * Get KPI instances for current user or team
 */
router.get('/instances', [
  authenticateToken,
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('status')
    .optional()
    .isIn(['active', 'paused', 'completed'])
    .withMessage('Status must be one of: active, paused, completed'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.id;
    const userRole = req.user!.role;
    const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const status = req.query.status as string;

    let instances;

    if (requestedUserId && requestedUserId !== currentUserId) {
      // Check if user has permission to view other user's instances
      if (userRole !== 'manager' && userRole !== 'both') {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You can only view your own KPI instances',
          timestamp: new Date().toISOString()
        });
      }
      instances = kpiService.getKPIInstancesByUser(requestedUserId, true);
    } else {
      instances = kpiService.getKPIInstancesByUser(currentUserId, true);
    }

    // Apply status filter if provided (active/inactive based on isActive property)
    if (status) {
      if (status === 'active') {
        instances = instances.filter(instance => instance.isActive);
      } else if (status === 'paused' || status === 'completed') {
        instances = instances.filter(instance => !instance.isActive);
      }
    }

    res.json({
      message: 'KPI instances retrieved successfully',
      instances,
      count: instances.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kpis/instances
 * Create a new KPI instance (manager only)
 */
router.post('/instances', [
  authenticateToken,
  requireRole(['manager']),
  body('definitionId')
    .isInt({ min: 1 })
    .withMessage('Definition ID must be a positive integer'),
  body('assignedToUserId')
    .isInt({ min: 1 })
    .withMessage('Assigned user ID must be a positive integer'),
  body('targetValue')
    .isNumeric()
    .withMessage('Target value must be a number'),
  body('targetDate')
    .isISO8601()
    .withMessage('Target date must be a valid ISO 8601 date'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { definitionId, assignedToUserId, targetValue, targetDate } = req.body;
    const assignedByUserId = req.user!.id;

    const instance = kpiService.assignKPI({
      definitionId,
      userId: assignedToUserId,
      startDate: new Date(),
      endDate: new Date(targetDate)
    });

    res.status(201).json({
      message: 'KPI instance created successfully',
      instance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpis/instances/:id
 * Get KPI instance details
 */
router.get('/instances/:id', [
  authenticateToken,
  param('id')
    .isInt({ min: 1 })
    .withMessage('KPI instance ID must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instanceId = parseInt(req.params.id);
    const currentUserId = req.user!.id;
    const userRole = req.user!.role;

    const instance = kpiService.getKPIInstance(instanceId);

    if (!instance) {
      return res.status(404).json({
        error: 'KPI Instance Not Found',
        message: 'KPI instance with the specified ID does not exist',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user has access to this instance
    const hasAccess = userRole === 'manager' || 
                     userRole === 'both' ||
                     instance.userId === currentUserId;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to view this KPI instance',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: 'KPI instance retrieved successfully',
      instance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/kpis/instances/:id/status
 * Update KPI instance status
 */
router.put('/instances/:id/status', [
  authenticateToken,
  param('id')
    .isInt({ min: 1 })
    .withMessage('KPI instance ID must be a positive integer'),
  body('status')
    .isIn(['active', 'paused', 'completed'])
    .withMessage('Status must be one of: active, paused, completed'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instanceId = parseInt(req.params.id);
    const { status } = req.body;
    const currentUserId = req.user!.id;
    const userRole = req.user!.role;

    const instance = kpiService.getKPIInstance(instanceId);

    if (!instance) {
      return res.status(404).json({
        error: 'KPI Instance Not Found',
        message: 'KPI instance with the specified ID does not exist',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user has permission to update this instance
    const canUpdate = userRole === 'manager' || userRole === 'both';

    if (!canUpdate) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to update this KPI instance',
        timestamp: new Date().toISOString()
      });
    }

    // Handle status updates (deactivate/reactivate)
    let updatedInstance;
    if (status === 'active') {
      updatedInstance = kpiService.reactivateKPIInstance(instanceId);
    } else {
      const result = kpiService.deactivateKPIInstance(instanceId);
      if (result) {
        updatedInstance = kpiService.getKPIInstance(instanceId);
      }
    }

    res.json({
      message: 'KPI instance status updated successfully',
      instance: updatedInstance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as kpiRouter };
