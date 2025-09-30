/**
 * Contract tests for Teams Management API
 * These tests validate API contract compliance and MUST FAIL until implementation is complete
 * Based on: specs/001-kpi-tracker-with/contracts/teams.md
 */

describe('Teams Management API Contract', () => {
  const BASE_URL = '/api/teams';

  describe('POST /', () => {
    const endpoint = BASE_URL;

    describe('Authentication Requirements', () => {
      it('should require Bearer token authentication', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            name: 'Test Team',
            description: 'Test description',
            memberIds: [2, 3]
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
            name: 'Test Team',
            description: 'Test description',
            memberIds: [2, 3]
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

      it('should require team name', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            description: 'Test description',
            memberIds: [2, 3]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('name'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should enforce name length limit', async () => {
        const longName = 'a'.repeat(256); // Exceeds 255 char limit
        
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: longName,
            description: 'Test description',
            memberIds: [2, 3]
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('name'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should require memberIds array', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Test Team',
            description: 'Test description'
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('memberIds'),
          code: 'VALIDATION_ERROR'
        });
      });

      it('should validate memberIds are valid user IDs', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Test Team',
            description: 'Test description',
            memberIds: [999, 1000] // Non-existent user IDs
          }
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Some users are not registered employees',
          code: 'INVALID_MEMBERS',
          invalidIds: [999, 1000]
        });
      });

      it('should prevent duplicate team names per manager', async () => {
        // Create first team
        await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Duplicate Team',
            description: 'First team',
            memberIds: [2]
          }
        });

        // Try to create second team with same name
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Duplicate Team',
            description: 'Second team',
            memberIds: [3]
          }
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('already exists'),
          code: 'TEAM_NAME_EXISTS'
        });
      });
    });

    describe('Success Response Schema', () => {
      let managerToken: string;

      beforeEach(async () => {
        managerToken = await getAuthToken('manager@test.com');
      });

      it('should return 201 with correct team data', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          },
          body: {
            name: 'Frontend Development Team',
            description: 'Team responsible for UI/UX development',
            memberIds: [2, 3, 4]
          }
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          team: {
            id: expect.any(Number),
            name: 'Frontend Development Team',
            description: 'Team responsible for UI/UX development',
            managerId: expect.any(Number),
            memberCount: 3,
            createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          }
        });
      });
    });
  });

  describe('GET /managed', () => {
    const endpoint = `${BASE_URL}/managed`;

    describe('Success Response Schema', () => {
      it('should return teams managed by authenticated user', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          teams: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              name: expect.any(String),
              description: expect.any(String),
              managerId: expect.any(Number),
              memberCount: expect.any(Number),
              createdAt: expect.any(String)
            })
          ])
        });
      });

      it('should return empty array for manager with no teams', async () => {
        const newManagerToken = await getAuthToken('newmanager@test.com');
        
        const response = await makeRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${newManagerToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          teams: []
        });
      });
    });
  });

  describe('GET /{id}/members', () => {
    describe('Success Response Schema', () => {
      it('should return team members with role information', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        const teamId = 1; // Assuming team exists
        
        const response = await makeRequest(`${BASE_URL}/${teamId}/members`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          team: {
            id: teamId,
            name: expect.any(String),
            managerId: expect.any(Number)
          },
          members: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              email: expect.any(String),
              firstName: expect.any(String),
              lastName: expect.any(String),
              role: expect.stringMatching(/^(employee|manager|both)$/),
              joinedAt: expect.any(String),
              roleInTeam: expect.any(String)
            })
          ])
        });
      });

      it('should return 404 for non-existent team', async () => {
        const managerToken = await getAuthToken('manager@test.com');
        
        const response = await makeRequest(`${BASE_URL}/999/members`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${managerToken}`
          }
        });

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Team not found',
          code: 'TEAM_NOT_FOUND'
        });
      });

      it('should return 403 for unauthorized team access', async () => {
        const otherManagerToken = await getAuthToken('othermanager@test.com');
        const teamId = 1; // Team managed by different manager
        
        const response = await makeRequest(`${BASE_URL}/${teamId}/members`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${otherManagerToken}`
          }
        });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: 'Access denied to this team',
          code: 'TEAM_ACCESS_DENIED'
        });
      });
    });
  });
});

// Test helper functions (these will fail until implementation exists)
import { makeRequest, getAuthToken } from '../utils/testHelpers';
