/**
 * Authentication Service
 * Handles JWT tokens, login, registration, email verification, and password reset
 * Based on: specs/001-kpi-tracker-with/data-model.md and API contracts
 */

import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { UserModel, CreateUserData, UserSafeData } from '../models/User';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresIn: string;
  user: UserSafeData;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
}

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  passwordResetTokenExpiresIn: string;
  emailVerificationTokenExpiresIn: string;
}

export class AuthenticationService {
  private getUserModel: () => UserModel;
  private config: AuthServiceConfig;

  constructor(config?: Partial<AuthServiceConfig>) {
    this.getUserModel = () => new UserModel();
    this.config = {
      jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
      passwordResetTokenExpiresIn: process.env.PASSWORD_RESET_EXPIRES_IN || '1h',
      emailVerificationTokenExpiresIn: process.env.EMAIL_VERIFICATION_EXPIRES_IN || '24h',
      ...config
    };
  }

  /**
   * Register a new user
   */
  async register(userData: CreateUserData): Promise<{
    user: UserSafeData;
    verificationRequired: boolean;
    message: string;
  }> {
    try {
      // Create user with hashed password
      const userModel = this.getUserModel();
      const user = await userModel.create(userData);
      
      return {
        user,
        verificationRequired: true,
        message: 'Registration successful. Please check your email to verify your account.'
      };
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        throw new Error('An account with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Authenticate user and return JWT token
   */
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const { email, password } = credentials;

    // Find user by email
    const userModel = this.getUserModel();
    const user = userModel.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error('Please verify your email before logging in');
    }

    // Validate password
    const isValidPassword = await userModel.validateUserPassword(user.id, password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateAccessToken(user);
    
    return {
      token,
      expiresIn: this.config.jwtExpiresIn,
      user: userModel.toSafeData(user)
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{
    success: boolean;
    message: string;  
    user?: UserSafeData;
  }> {
    try {
      const userModel = this.getUserModel();
      const isVerified = userModel.verifyEmail(token);
      
      if (isVerified) {
        // Get the user by token to return safe data
        const user = userModel.findByVerificationToken(token);
        return {
          success: true,
          message: 'Email verified successfully. You can now log in.',
          user: user ? userModel.toSafeData(user) : undefined
        };
      } else {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Invalid or expired verification token'
      };
    }
  }

  /**
   * Resend email verification
   */
  async resendVerification(email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const userModel = this.getUserModel();
    const user = userModel.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If the email exists, a verification link has been sent.'
      };
    }

    if (user.emailVerified) {
      return {
        success: false,
        message: 'Email is already verified'
      };
    }

    await userModel.generateNewVerificationToken(user.id);

    return {
      success: true,
      message: 'Verification email sent successfully'
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    const { email } = request;
    
    const userModel = this.getUserModel();
    const user = userModel.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      };
    }

    await userModel.generatePasswordResetToken(user.id);

    return {
      success: true,
      message: 'Password reset email sent successfully'
    };
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<{
    success: boolean;
    message: string;
  }> {
    const { token, newPassword } = request;

    try {
      const userModel = this.getUserModel();
      await userModel.resetPassword(token, newPassword);
      
      return {
        success: true,
        message: 'Password reset successfully. You can now log in with your new password.'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Invalid or expired reset token'
      };
    }
  }

  /**
   * Validate and decode JWT token
   */
  validateToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as TokenPayload;
      
      // Check if user still exists and is active
      const userModel = this.getUserModel();
      const user = userModel.findById(decoded.userId);
      if (!user || !user.emailVerified) {
        throw new Error('User not found or inactive');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(user: UserSafeData): string {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user: UserSafeData): string {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.refreshTokenExpiresIn
    } as jwt.SignOptions);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(request: RefreshTokenRequest): Promise<AuthToken> {
    const { refreshToken } = request;

    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const userModel = this.getUserModel();
      const user = userModel.findById(decoded.userId);
      if (!user || !user.emailVerified) {
        throw new Error('User not found or inactive');
      }

      const safeUser = userModel.toSafeData(user);
      const newToken = this.generateAccessToken(safeUser);

      return {
        token: newToken,
        expiresIn: this.config.jwtExpiresIn,
        user: safeUser
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Get user from token
   */
  getUserFromToken(token: string): UserSafeData {
    const decoded = this.validateToken(token);
    const userModel = this.getUserModel();
    const user = userModel.findById(decoded.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return userModel.toSafeData(user);
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // Validate current password
    const userModel = this.getUserModel();
    const isValidPassword = await userModel.validateUserPassword(userId, currentPassword);
    if (!isValidPassword) {
      return {
        success: false,
        message: 'Current password is incorrect'
      };
    }

    // Update password
    await userModel.updatePassword(userId, newPassword);

    return {
      success: true,
      message: 'Password updated successfully'
    };
  }

  /**
   * Logout user (invalidate token on client side)
   * Note: With JWT, we can't invalidate server-side without a blacklist
   */
  async logout(): Promise<{
    success: boolean;
    message: string;
  }> {
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }

  /**
   * Check if user has required role
   */
  hasRole(user: UserSafeData, requiredRole: string | string[]): boolean {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // 'both' role has access to both manager and employee functions
    if (user.role === 'both') {
      return roles.includes('manager') || roles.includes('employee');
    }
    
    return roles.includes(user.role);
  }

  /**
   * Check if user can access manager functions
   */
  canAccessManagerFeatures(user: UserSafeData): boolean {
    return this.hasRole(user, ['manager', 'both']);
  }

  /**
   * Check if user can access employee features
   */
  canAccessEmployeeFeatures(user: UserSafeData): boolean {
    return this.hasRole(user, ['employee', 'both']);
  }

  /**
   * Extract bearer token from authorization header
   */
  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash token for storage (if needed for token blacklisting)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
