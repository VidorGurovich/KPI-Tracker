/**
 * Contract tests for Authentication API
 * These tests validate API contract compliance and MUST FAIL until implementation is complete
 * Based on: specs/001-kpi-tracker-with/contracts/auth.md
 */

describe('Authentication API Contract', () => {
  const BASE_URL = '/api/auth';

  describe('POST /register', () => {
    const endpoint = `${BASE_URL}/register`;

    describe('Request Schema Validation', () => {
      it('should require valid email format', async () => {
        const invalidEmails = ['invalid', 'test@', '@example.com', 'test.example.com'];
        
        for (const email of invalidEmails) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            body: {
              email,
              password: 'SecurePass123!',
              firstName: 'John',
              lastName: 'Doe',
              role: 'employee'
            }
          });
          
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toContain('email');
        }
      });

      it('should require password with complexity rules', async () => {
        const weakPasswords = ['short', 'alllowercase', 'ALLUPPERCASE', 'NoNumbers!', '12345678'];
        
        for (const password of weakPasswords) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            body: {
              email: 'test@example.com',
              password,
              firstName: 'John',
              lastName: 'Doe',
              role: 'employee'
            }
          });
          
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toContain('password');
        }
      });

      it('should require valid role enum', async () => {
        const invalidRoles = ['admin', 'user', 'invalid', ''];
        
        for (const role of invalidRoles) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            body: {
              email: 'test@example.com',
              password: 'SecurePass123!',
              firstName: 'John',
              lastName: 'Doe',
              role
            }
          });
          
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toContain('role');
        }
      });

      it('should require all mandatory fields', async () => {
        const requiredFields = ['email', 'password', 'firstName', 'lastName', 'role'];
        
        for (const field of requiredFields) {
          const body = {
            email: 'test@example.com',
            password: 'SecurePass123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'employee'
          };
          delete body[field as keyof typeof body];
          
          const response = await makeRequest(endpoint, {
            method: 'POST',
            body
          });
          
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toContain(field);
        }
      });
    });

    describe('Success Response Schema', () => {
      it('should return 201 with correct response schema for valid registration', async () => {
        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            email: 'newuser@example.com',
            password: 'SecurePass123!',
            firstName: 'John',
            lastName: 'Doe',
            role: 'employee'
          }
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('verification'),
          user: {
            id: expect.any(Number),
            email: 'newuser@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'employee',
            emailVerified: false
          }
        });
        
        // Password should never be in response
        expect(response.body.user.password).toBeUndefined();
        expect(response.body.user.passwordHash).toBeUndefined();
      });
    });

    describe('Error Response Schema', () => {
      it('should return 409 for duplicate email registration', async () => {
        // First registration
        await makeRequest(endpoint, {
          method: 'POST',
          body: {
            email: 'duplicate@example.com',
            password: 'SecurePass123!',
            firstName: 'First',
            lastName: 'User',
            role: 'employee'
          }
        });

        // Duplicate registration
        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            email: 'duplicate@example.com',
            password: 'DifferentPass123!',
            firstName: 'Second',
            lastName: 'User',
            role: 'manager'
          }
        });

        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('email'),
          code: 'EMAIL_EXISTS'
        });
      });
    });
  });

  describe('POST /login', () => {
    const endpoint = `${BASE_URL}/login`;

    describe('Success Response Schema', () => {
      it('should return 200 with JWT token for valid credentials', async () => {
        // First register a user
        await makeRequest(`${BASE_URL}/register`, {
          method: 'POST',
          body: {
            email: 'logintest@example.com',
            password: 'SecurePass123!',
            firstName: 'Login',
            lastName: 'Test',
            role: 'employee'
          }
        });

        // Verify email (in real implementation)
        await verifyUserEmail('logintest@example.com');

        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            email: 'logintest@example.com',
            password: 'SecurePass123!'
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          token: expect.stringMatching(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/), // JWT format
          user: {
            id: expect.any(Number),
            email: 'logintest@example.com',
            firstName: 'Login',
            lastName: 'Test',
            role: 'employee',
            emailVerified: true
          },
          expiresIn: '24h'
        });
      });
    });

    describe('Error Response Schema', () => {
      it('should return 401 for invalid credentials', async () => {
        const invalidCredentials = [
          { email: 'nonexistent@example.com', password: 'SecurePass123!' },
          { email: 'logintest@example.com', password: 'WrongPassword123!' }
        ];

        for (const credentials of invalidCredentials) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            body: credentials
          });

          expect(response.status).toBe(401);
          expect(response.body).toMatchObject({
            success: false,
            error: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          });
        }
      });

      it('should return 401 for unverified email', async () => {
        // Register but don't verify
        await makeRequest(`${BASE_URL}/register`, {
          method: 'POST',
          body: {
            email: 'unverified@example.com',
            password: 'SecurePass123!',
            firstName: 'Unverified',
            lastName: 'User',
            role: 'employee'
          }
        });

        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            email: 'unverified@example.com',
            password: 'SecurePass123!'
          }
        });

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('verify'),
          code: 'EMAIL_NOT_VERIFIED'
        });
      });
    });
  });

  describe('POST /verify', () => {
    const endpoint = `${BASE_URL}/verify`;

    describe('Success Response Schema', () => {
      it('should return 200 for valid verification token', async () => {
        // Register user to get verification token
        const registerResponse = await makeRequest(`${BASE_URL}/register`, {
          method: 'POST',
          body: {
            email: 'verify@example.com',
            password: 'SecurePass123!',
            firstName: 'Verify',
            lastName: 'Test',
            role: 'employee'
          }
        });

        const verificationToken = await getVerificationToken('verify@example.com');

        const response = await makeRequest(endpoint, {
          method: 'POST',
          body: {
            token: verificationToken
          }
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('verified'),
          user: {
            id: expect.any(Number),
            email: 'verify@example.com',
            emailVerified: true
          }
        });
      });
    });

    describe('Error Response Schema', () => {
      it('should return 400 for invalid verification token', async () => {
        const invalidTokens = ['invalid', '', 'expired-token-123'];

        for (const token of invalidTokens) {
          const response = await makeRequest(endpoint, {
            method: 'POST',
            body: { token }
          });

          expect(response.status).toBe(400);
          expect(response.body).toMatchObject({
            success: false,
            error: expect.stringContaining('token'),
            code: 'INVALID_TOKEN'
          });
        }
      });
    });
  });
});

import { makeRequest, verifyUserEmail, getVerificationToken } from '../utils/testHelpers';
