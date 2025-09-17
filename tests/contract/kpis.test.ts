/**
 * Contract tests for KPI Management API
 * These tests validate API contract compliance and MUST FAIL until implementation is complete
 * Based on: specs/001-kpi-tracker-with/contracts/kpis.md
 */

describe('KPI Management API Contract', () => {
  const BASE_URL = '/api/kpis';

  describe('POST /groups', () => {
    const endpoint = `${BASE_URL}/groups`;

    describe('Authentication and Authorization', () => {
      it('should require authentication', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            name: 'Test KPI Group',
            description: 'Test description',
            definitions: []
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
            name: 'Test KPI Group',
            description: 'Test description',
            definitions: []
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

      it('should require name field', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            description: 'Test description',
            definitions: [getSampleKPIDefinition()]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('name'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should enforce unique name per creator', async () => {
        // Create first group
        await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Duplicate Group Name',
            description: 'First group',
            definitions: [getSampleKPIDefinition()]
          }
        });

        // Try to create second group with same name
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Duplicate Group Name',
            description: 'Second group',
            definitions: [getSampleKPIDefinition()]
          }
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('already exists'),
          code: 'GROUP_NAME_EXISTS'
        });
      });

      it('should require at least one KPI definition', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Empty Group',
            description: 'Group with no definitions',
            definitions: []
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('definitions'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate KPI definition schema', async () => {
        const invalidDefinition = {
          category: 'Process & time',
          // Missing required fields
          targetValue: '≥95%'
        };

        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Invalid Definitions Group',
            description: 'Group with invalid definition',
            definitions: [invalidDefinition]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('definition'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate frequency enum values', async () => {
        const invalidDefinition = {
          ...getSampleKPIDefinition(),
          frequency: 'Invalid'
        };

        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Invalid Frequency Group',
            description: 'Group with invalid frequency',
            definitions: [invalidDefinition]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('frequency'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate target type enum values', async () => {
        const invalidDefinition = {
          ...getSampleKPIDefinition(),
          targetType: 'invalid'
        };

        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Invalid Target Type Group',
            description: 'Group with invalid target type',
            definitions: [invalidDefinition]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('targetType'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate weight is positive integer', async () => {
        const invalidDefinition = {
          ...getSampleKPIDefinition(),
          weight: -1
        };

        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Invalid Weight Group',
            description: 'Group with negative weight',
            definitions: [invalidDefinition]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('weight'),
          code: 'VALIDATION_ERROR'
        });
      });
    });

    describe('Success Response Schema', () => {
      let managerToken: string;

      beforeEach(async () => {
        managerToken = await getAuthToken('manager@test.com');
      });

      it('should return 201 with complete group data', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Intern Developers',
            description: 'KPI set for intern-level software developers',
            definitions: [getSampleKPIDefinition()]
          }
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          group: {
            id: expect.any(Number),
            name: 'Intern Developers',
            description: 'KPI set for intern-level software developers',
            definitionCount: 1,
            createdBy: expect.any(Number),
            createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            isActive: true
          },
          definitions: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              category: expect.any(String),
              metricName: expect.any(String),
              description: expect.any(String),
              frequency: expect.stringMatching(/^(Daily|Weekly|Sprint|Monthly)$/),
              targetType: expect.stringMatching(/^(percentage|numeric|boolean|string)$/),
              targetValue: expect.any(String),
              measurementMethod: expect.any(String),
              dataSource: expect.any(String),
              reviewCadence: expect.any(String),
              weight: expect.any(Number)
            })
          ])
        });
      });
    });
  });

  describe('GET /assigned', () => {
    const endpoint = `${BASE_URL}/assigned`;

    describe('Success Response Schema', () => {
      it('should return assigned KPIs for authenticated user', async () => {
        const employeeToken = await getAuthToken('employee@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${employeeToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          kpis: expect.arrayContaining([
            expect.objectContaining({
              instanceId: expect.any(Number),
              definition: expect.objectContaining({
                id: expect.any(Number),
                category: expect.any(String),
                metricName: expect.any(String),
                description: expect.any(String),
                frequency: expect.any(String),
                targetType: expect.any(String),
                targetValue: expect.any(String),
                weight: expect.any(Number)
              }),
              assignedBy: expect.objectContaining({
                id: expect.any(Number),
                firstName: expect.any(String),
                lastName: expect.any(String)
              }),
              assignedAt: expect.any(String),
              isActive: expect.any(Boolean),
              latestRecord: expect.any(Object) // Can be null if no records yet
            })
          ])
        });
      });

      it('should return empty array for user with no assigned KPIs', async () => {
        const newEmployeeToken = await getAuthToken('newemployee@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newEmployeeToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          kpis: []
        });
      });
    });
  });

  describe('POST /assignments', () => {
    const endpoint = `${BASE_URL}/assignments`;

    describe('Request Schema Validation', () => {
      let managerToken: string;

      beforeEach(async () => {
        managerToken = await getAuthToken('manager@test.com');
      });

      it('should require valid assignment data', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            groupId: 1,
            userIds: [2, 3, 4],
            notes: 'Initial KPI assignment for Q4'
          }
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          assignments: expect.arrayContaining([
            expect.objectContaining({
              instanceId: expect.any(Number),
              userId: expect.any(Number),
              definitionId: expect.any(Number),
              assignedAt: expect.any(String)
            })
          ]),
          totalAssigned: expect.any(Number)
        });
      });

      it('should validate user access to KPI group', async () => {
        const otherManagerToken = await getAuthToken('othermanager@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${otherManagerToken}`
          },
          body: {
            groupId: 1, // Group created by different manager
            userIds: [2, 3],
            notes: 'Unauthorized assignment attempt'
          }
        });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Access denied to this KPI group',
          code: 'GROUP_ACCESS_DENIED'
        });
      });

      it('should prevent duplicate assignments', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        
        // First assignment
        await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            groupId: 1,
            userIds: [2],
            notes: 'First assignment'
          }
        });

        // Duplicate assignment
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            groupId: 1,
            userIds: [2], // Same user, same group
            notes: 'Duplicate assignment'
          }
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('already assigned'),
          code: 'DUPLICATE_ASSIGNMENT',
          conflictingUsers: [2]
        });
      });
    });
  });
});

// Test helper functions
function getSampleKPIDefinition() {
  return {
    category: 'Process & time',
    metricName: 'Daily time logging (DevOps)',
    description: 'Log all hours worked today against DevOps tasks before day end; counts days with 100% same-day logs.',
    frequency: 'Weekly',
    targetType: 'percentage',
    targetValue: '≥95%',
    measurementMethod: 'Days with 100% hours logged same day + working days',
    dataSource: 'Azure DevOps',
    reviewCadence: 'End of week',
    weight: 10
  };
}

async function makeRequest(url: string, options: any) {
  throw new Error(`API endpoint ${url} not yet implemented`);
}

async function getAuthToken(email: string): Promise<string> {
  throw new Error('Authentication service not yet implemented');
}
