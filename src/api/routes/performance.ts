/**
 * Performance Tracking API Routes
 * Handles performance record creation, retrieval, and dashboard data
 * Based on: tests/contract/performance.test.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { KPIManagementService } from '../../services/KPIManagementService';
import { authMiddleware, requireRole } from '../middleware/auth';

// Mock interfaces for performance tracking until PerformanceTrackingService is implemented
interface PerformanceRecord {
  id: number;
  instanceId: number;
  value: string;
  calculatedScore: number;
  periodStart: Date;
  periodEnd: Date;
  recordedBy: number;
  recordedAt: Date;
  notes?: string;
}

interface CreatePerformanceRecordData {
  instanceId: number;
  value: string;
  periodStart: Date;
  periodEnd: Date;
  recordedBy: number;
  notes?: string;
}

// Mock PerformanceTrackingService
class MockPerformanceTrackingService {
  createPerformanceRecord(data: CreatePerformanceRecordData): PerformanceRecord {
    // Mock implementation - in reality this would save to database
    return {
      id: Math.floor(Math.random() * 1000),
      instanceId: data.instanceId,
      value: data.value,
      calculatedScore: 85.5, // Mock calculated score
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      recordedBy: data.recordedBy,
      recordedAt: new Date(),
      notes: data.notes
    };
  }

  getPerformanceRecords(instanceId: number, filters?: { fromDate?: Date; toDate?: Date }): PerformanceRecord[] {
    // Mock implementation - return empty array for now
    return [];
  }
}

const router = Router();

// Lazy initialization factory functions
const getKPIService = () => new KPIManagementService();
const getPerformanceService = () => new MockPerformanceTrackingService();

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
 * POST /api/performance/records
 * Create a new performance record (Manager role required)
 */
router.post('/records', [
  authMiddleware,
  requireRole(['manager', 'both']),
  body('instanceId')
    .isInt({ min: 1 })
    .withMessage('Instance ID must be a positive integer'),
  body('value')
    .notEmpty()
    .withMessage('Value is required'),
  body('periodStart')
    .isISO8601({ strict: true })
    .withMessage('Period start must be a valid ISO date'),
  body('periodEnd')
    .isISO8601({ strict: true })
    .withMessage('Period end must be a valid ISO date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId, value, periodStart, periodEnd, notes } = req.body;
    const recordedBy = req.user!.id;
    
    const kpiService = getKPIService();
    const performanceService = getPerformanceService();

    // Validate dates
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    
    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        error: 'Period end must be after period start',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Validate instance exists
    const instance = kpiService.getKPIInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'KPI instance not found',
        code: 'INSTANCE_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Validate frequency alignment (simplified check)
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const frequency = instance.definitionFrequency.toLowerCase();
    
    let expectedDays = 7; // Default weekly
    if (frequency === 'daily') expectedDays = 1;
    else if (frequency === 'monthly') expectedDays = 30;
    else if (frequency === 'quarterly') expectedDays = 90;

    if (Math.abs(periodDays - expectedDays) > 2) { // Allow 2-day tolerance
      return res.status(400).json({
        success: false,
        error: `Period length (${periodDays} days) does not match KPI frequency (${frequency})`,
        code: 'PERIOD_FREQUENCY_MISMATCH',
        timestamp: new Date().toISOString()
      });
    }

    // Check for duplicate records (simplified check)
    // In a real implementation, we'd check the PerformanceTrackingService
    // For now, we'll assume no duplicates

    // Create performance record
    const record = performanceService.createPerformanceRecord({
      instanceId,
      value,
      periodStart: startDate,
      periodEnd: endDate,
      recordedBy,
      notes: notes || undefined
    });

    // Calculate score (simplified calculation)
    const targetValue = instance.definitionTargetValue;
    const numericValue = parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
    const targetMet = numericValue >= targetValue;
    const scorePercentage = Math.min((numericValue / targetValue) * 100, 100);

    res.status(201).json({
      success: true,
      record: {
        id: record.id,
        instanceId: record.instanceId,
        value: record.value,
        calculatedScore: record.calculatedScore,
        periodStart: record.periodStart.toISOString().split('T')[0],
        periodEnd: record.periodEnd.toISOString().split('T')[0],
        recordedBy: record.recordedBy,
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes
      },
      scoreCalculation: {
        targetValue: targetValue.toString(),
        actualValue: value,
        targetMet,
        scorePercentage
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Performance record creation error:', error);
    
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'A performance record already exists for this period',
        code: 'DUPLICATE_RECORD',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.message && error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this KPI instance',
        code: 'INSTANCE_ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'RECORD_CREATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/performance/records/{instanceId}
 * Get performance history for a KPI instance
 */
router.get('/records/:instanceId', [
  authMiddleware,
  param('instanceId')
    .isInt({ min: 1 })
    .withMessage('Instance ID must be a positive integer'),
  query('from')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('From date must be a valid ISO date'),
  query('to')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('To date must be a valid ISO date'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instanceId = parseInt(req.params.instanceId);
    const fromDate = req.query.from ? new Date(req.query.from as string) : undefined;
    const toDate = req.query.to ? new Date(req.query.to as string) : undefined;
    
    const kpiService = getKPIService();
    const performanceService = getPerformanceService();

    // Validate instance exists and user has access
    const instance = kpiService.getKPIInstance(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'KPI instance not found',
        code: 'INSTANCE_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Check access (managers can see all, employees can see their own)
    const userRole = req.user!.role;
    const userId = req.user!.id;
    const hasAccess = userRole === 'manager' || userRole === 'both' || instance.userId === userId;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this KPI instance',
        code: 'INSTANCE_ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    // Get performance records
    const records = performanceService.getPerformanceRecords(instanceId, {
      fromDate,
      toDate
    });

    // Calculate summary statistics
    const totalRecords = records.length;
    const averageScore = totalRecords > 0 
      ? records.reduce((sum: number, record: PerformanceRecord) => sum + record.calculatedScore, 0) / totalRecords 
      : 0;
    const latestScore = totalRecords > 0 ? records[records.length - 1].calculatedScore : 0;
    
    // Simple trend calculation
    let trend = 'stable';
    if (totalRecords >= 2) {
      const recentAvg = records.slice(-3).reduce((sum: number, r: PerformanceRecord) => sum + r.calculatedScore, 0) / Math.min(3, records.length);
      const earlierAvg = records.slice(0, -3).reduce((sum: number, r: PerformanceRecord) => sum + r.calculatedScore, 0) / Math.max(1, records.length - 3);
      
      if (recentAvg > earlierAvg + 5) trend = 'improving';
      else if (recentAvg < earlierAvg - 5) trend = 'declining';
    }

    res.json({
      success: true,
      instance: {
        id: instance.id,
        definition: {
          metricName: instance.definitionName,
          targetValue: instance.definitionTargetValue.toString(),
          frequency: instance.definitionFrequency
        },
        user: {
          firstName: instance.userFirstName,
          lastName: instance.userLastName
        }
      },
      records: records.map((record: PerformanceRecord) => ({
        id: record.id,
        value: record.value,
        calculatedScore: record.calculatedScore,
        periodStart: record.periodStart.toISOString().split('T')[0],
        periodEnd: record.periodEnd.toISOString().split('T')[0],
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes || ''
      })),
      summary: {
        totalRecords,
        averageScore: Math.round(averageScore * 100) / 100,
        latestScore,
        trend
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get performance records error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'FETCH_RECORDS_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/performance/dashboard/{userId}
 * Get performance dashboard for a user
 */
router.get('/dashboard/:userId', [
  authMiddleware,
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const currentUserId = req.user!.id;
    const userRole = req.user!.role;
    
    // Check access permissions
    const hasAccess = userRole === 'manager' || userRole === 'both' || currentUserId === targetUserId;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this user dashboard',
        code: 'USER_ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    const kpiService = getKPIService();
    const performanceService = getPerformanceService();

    // Get user KPI instances
    const instances = kpiService.getKPIInstancesByUser(targetUserId, true);
    
    if (instances.length === 0) {
      return res.json({
        success: true,
        user: {
          id: targetUserId,
          firstName: 'Unknown',
          lastName: 'User'
        },
        summary: {
          totalKPIs: 0,
          averageScore: 0,
          completionRate: 0,
          trend: 'stable'
        },
        kpiPerformance: [],
        chartData: {
          scoreHistory: [],
          categoryBreakdown: [],
          frequencyDistribution: []
        },
        timestamp: new Date().toISOString()
      });
    }

    // Get user info from first instance
    const userInfo = {
      id: targetUserId,
      firstName: instances[0].userFirstName,
      lastName: instances[0].userLastName
    };

    // Calculate performance for each KPI
    const kpiPerformance = [];
    let totalScore = 0;
    let totalRecords = 0;

    for (const instance of instances) {
      const records = performanceService.getPerformanceRecords(instance.id);
      const latestRecord = records.length > 0 ? records[records.length - 1] : null;
      const avgScore = records.length > 0 
        ? records.reduce((sum: number, r: PerformanceRecord) => sum + r.calculatedScore, 0) / records.length 
        : 0;

      if (records.length > 0) {
        totalScore += avgScore;
        totalRecords++;
      }

      // Simple trend calculation
      let trend = 'stable';
      if (records.length >= 2) {
        const recent = records.slice(-2);
        if (recent[1].calculatedScore > recent[0].calculatedScore + 5) trend = 'improving';
        else if (recent[1].calculatedScore < recent[0].calculatedScore - 5) trend = 'declining';
      }

      kpiPerformance.push({
        instanceId: instance.id,
        category: instance.groupName || 'General',
        metricName: instance.definitionName,
        currentScore: latestRecord ? latestRecord.calculatedScore : 0,
        targetValue: instance.definitionTargetValue.toString(),
        frequency: instance.definitionFrequency,
        lastRecorded: latestRecord ? latestRecord.recordedAt.toISOString() : '',
        trend
      });
    }

    const averageScore = totalRecords > 0 ? totalScore / totalRecords : 0;
    const completionRate = (totalRecords / instances.length) * 100;

    // Create chart data (simplified)
    const chartData = {
      scoreHistory: [], // Would need to aggregate historical data
      categoryBreakdown: [], // Would need to group by category
      frequencyDistribution: [] // Would need to count by frequency
    };

    res.json({
      success: true,
      user: userInfo,
      summary: {
        totalKPIs: instances.length,
        averageScore: Math.round(averageScore * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        trend: 'stable' // Would need more sophisticated calculation
      },
      kpiPerformance,
      chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get performance dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'DASHBOARD_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as performanceRouter };