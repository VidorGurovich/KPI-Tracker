/**
 * Contract tests for Performance Tracking API
 * These tests validate API contract compliance and MUST FAIL until implementation is complete
 * Based on: specs/001-kpi-tracker-with/contracts/performance.md
 */

describe('Performance Tracking API Contract', () => {
  const BASE_URL = '/api/performance';

  describe('POST /records', () => {
    const endpoint = `${BASE_URL}/records`;

    describe('Authentication and Authorization', () => {
      it('should require authentication', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            instanceId: 1,
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13',
            notes: 'Test record'
          }
        });

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      });

      it('should require manager role', async () => {
        const employeeToken = await getAuthToken('employee@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${employeeToken}`
          },
          body: {
            instanceId: 1,
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13',
            notes: 'Test record'
          }
        });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Manager role required',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      });
    });

    describe('Request Schema Validation', () => {
      let managerToken: string;

      beforeEach(async () => {
        managerToken = await getAuthToken('manager@test.com');
      });

      it('should require instanceId', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13'
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('instanceId'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate instanceId exists', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            instanceId: 999, // Non-existent instance
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13'
          }
        });

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          success: false,
          error: 'KPI instance not found',
          code: 'INSTANCE_NOT_FOUND'
        });
      });

      it('should require value field', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            instanceId: 1,
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13'
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('value'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate date format and order', async () => {
        const invalidDateCombinations = [
          { periodStart: 'invalid-date', periodEnd: '2025-09-13' },
          { periodStart: '2025-09-09', periodEnd: 'invalid-date' },
          { periodStart: '2025-09-13', periodEnd: '2025-09-09' } // End before start
        ];

        for (const dates of invalidDateCombinations) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${managerToken}`
            },
            body: {
              instanceId: 1,
              value: '98%',
              ...dates
            }
          });

          expect(response.status).toBe(400);
          expect(response.body).toMatchObject({
            success: false,
            error: expect.stringContaining('period'),
            code: 'VALIDATION_ERROR'
          });
        }
      });

      it('should validate period alignment with KPI frequency', async () => {
        // For a weekly KPI, period should be 7 days
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            instanceId: 1, // Weekly KPI
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-12' // Only 3 days for weekly KPI
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('frequency'),
          code: 'PERIOD_FREQUENCY_MISMATCH'
        });
      });

      it('should prevent duplicate records for same period', async () => {
        // Create first record
        await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            instanceId: 1,
            value: '95%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13',
            notes: 'First record'
          }
        });

        // Try to create duplicate record
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            instanceId: 1,
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13',
            notes: 'Duplicate record'
          }
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('already exists'),
          code: 'DUPLICATE_RECORD'
        });
      });

      it('should validate manager has access to KPI instance', async () => {
        const otherManagerToken = await getAuthToken('othermanager@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${otherManagerToken}`
          },
          body: {
            instanceId: 1, // Instance managed by different manager
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13'
          }
        });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Access denied to this KPI instance',
          code: 'INSTANCE_ACCESS_DENIED'
        });
      });
    });

    describe('Success Response Schema', () => {
      let managerToken: string;

      beforeEach(async () => {
        managerToken = await getAuthToken('manager@test.com');
      });

      it('should return 201 with complete record data and score calculation', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            instanceId: 1,
            value: '98%',
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13',
            notes: 'Excellent performance this week, all tasks logged same day'
          }
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          record: {
            id: expect.any(Number),
            instanceId: 1,
            value: '98%',
            calculatedScore: expect.any(Number),
            periodStart: '2025-09-09',
            periodEnd: '2025-09-13',
            recordedBy: expect.any(Number),
            recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            notes: 'Excellent performance this week, all tasks logged same day'
          },
          scoreCalculation: expect.objectContaining({
            targetValue: expect.any(String),
            actualValue: '98%',
            targetMet: expect.any(Boolean),
            scorePercentage: expect.any(Number)
          })
        });
      });

      it('should calculate score correctly for different target types', async () => {
        const testCases = [
          { targetType: 'percentage', targetValue: '≥95%', actualValue: '98%', expectedMet: true },
          { targetType: 'numeric', targetValue: '≤1.5', actualValue: '1.2', expectedMet: true },
          { targetType: 'boolean', targetValue: 'Yes', actualValue: 'Yes', expectedMet: true },
          { targetType: 'string', targetValue: 'Within 1 business day', actualValue: 'Same day', expectedMet: true }
        ];

        for (const testCase of testCases) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${managerToken}`
            },
            body: {
              instanceId: getInstanceIdForTargetType(testCase.targetType),
              value: testCase.actualValue,
              periodStart: '2025-09-09',
              periodEnd: '2025-09-13'
            }
          });

          expect(response.status).toBe(201);
          expect(response.body.scoreCalculation.targetMet).toBe(testCase.expectedMet);
        }
      });
    });
  });

  describe('GET /records/{instanceId}', () => {
    describe('Success Response Schema', () => {
      it('should return performance history for KPI instance', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        const instanceId = 1;
        
        const response = await makeRequest(`${BASE_URL}/records/${instanceId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          instance: expect.objectContaining({
            id: instanceId,
            definition: expect.objectContaining({
              metricName: expect.any(String),
              targetValue: expect.any(String),
              frequency: expect.any(String)
            }),
            user: expect.objectContaining({
              firstName: expect.any(String),
              lastName: expect.any(String)
            })
          }),
          records: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              value: expect.any(String),
              calculatedScore: expect.any(Number),
              periodStart: expect.any(String),
              periodEnd: expect.any(String),
              recordedAt: expect.any(String),
              notes: expect.any(String)
            })
          ]),
          summary: expect.objectContaining({
            totalRecords: expect.any(Number),
            averageScore: expect.any(Number),
            latestScore: expect.any(Number),
            trend: expect.stringMatching(/^(improving|declining|stable)$/)
          })
        });
      });

      it('should support date range filtering', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        const instanceId = 1;
        
        const response = await makeRequest(`${BASE_URL}/records/${instanceId}?from=2025-09-01&to=2025-09-30`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // All records should be within date range
        response.body.records.forEach((record: any) => {
          expect(new Date(record.periodStart).getTime()).toBeGreaterThanOrEqual(new Date('2025-09-01').getTime());
          expect(new Date(record.periodEnd).getTime()).toBeLessThanOrEqual(new Date('2025-09-30').getTime());
        });
      });
    });

    describe('Error Response Schema', () => {
      it('should return 404 for non-existent instance', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        
        const response = await makeRequest(`${BASE_URL}/records/999`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          success: false,
          error: 'KPI instance not found',
          code: 'INSTANCE_NOT_FOUND'
        });
      });

      it('should return 403 for unauthorized access', async () => {
        const otherManagerToken = await getAuthToken('othermanager@test.com');
        
        const response = await makeRequest(`${BASE_URL}/records/1`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${otherManagerToken}`
          }
        });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Access denied to this KPI instance',
          code: 'INSTANCE_ACCESS_DENIED'
        });
      });
    });
  });

  describe('GET /dashboard/{userId}', () => {
    describe('Success Response Schema', () => {
      it('should return comprehensive performance dashboard', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        const userId = 2; // Employee user
        
        const response = await makeRequest(`${BASE_URL}/dashboard/${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          user: expect.objectContaining({
            id: userId,
            firstName: expect.any(String),
            lastName: expect.any(String)
          }),
          summary: expect.objectContaining({
            totalKPIs: expect.any(Number),
            averageScore: expect.any(Number),
            completionRate: expect.any(Number),
            trend: expect.stringMatching(/^(improving|declining|stable)$/)
          }),
          kpiPerformance: expect.arrayContaining([
            expect.objectContaining({
              instanceId: expect.any(Number),
              category: expect.any(String),
              metricName: expect.any(String),
              currentScore: expect.any(Number),
              targetValue: expect.any(String),
              frequency: expect.any(String),
              lastRecorded: expect.any(String),
              trend: expect.stringMatching(/^(improving|declining|stable)$/)
            })
          ]),
          chartData: expect.objectContaining({
            scoreHistory: expect.any(Array),
            categoryBreakdown: expect.any(Array),
            frequencyDistribution: expect.any(Array)
          })
        });
      });
    });
  });
});

import { makeRequest, getAuthToken, getInstanceIdForTargetType } from '../utils/testHelpers';
