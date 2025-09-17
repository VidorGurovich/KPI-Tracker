/**
 * User Model
 * Handles user authentication, role management, and profile data
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
  verificationToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'manager' | 'employee' | 'both';

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UserSafeData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new user with hashed password and verification token
   */
  async create(userData: CreateUserData): Promise<UserSafeData> {
    const { email, password, firstName, lastName, role } = userData;

    // Validate email uniqueness
    if (this.findByEmail(email)) {
      throw new Error('Email already registered');
    }

    // Validate password complexity
    this.validatePassword(password);

    // Validate role
    this.validateRole(role);

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = this.generateVerificationToken();

    const stmt = this.db.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, verification_token)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(email, passwordHash, firstName, lastName, role, verificationToken);
    const userId = result.lastInsertRowid as number;

    const user = this.findById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return this.toSafeData(user);
  }

  /**
   * Find user by ID
   */
  findById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapRowToUser(row);
  }

  /**
   * Find user by email
   */
  findByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    
    if (!row) return null;
    
    return this.mapRowToUser(row);
  }

  /**
   * Find user by verification token
   */
  findByVerificationToken(token: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE verification_token = ?');
    const row = stmt.get(token) as any;
    
    if (!row) return null;
    
    return this.mapRowToUser(row);
  }

  /**
   * Verify user password
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = this.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Mark email as verified
   */
  verifyEmail(token: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET email_verified = TRUE, verification_token = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE verification_token = ?
    `);

    const result = stmt.run(token);
    return result.changes > 0;
  }

  /**
   * Update user profile
   */
  updateProfile(id: number, updates: Partial<Pick<User, 'firstName' | 'lastName'>>): UserSafeData | null {
    const fields = [];
    const values = [];

    if (updates.firstName) {
      fields.push('first_name = ?');
      values.push(updates.firstName);
    }

    if (updates.lastName) {
      fields.push('last_name = ?');
      values.push(updates.lastName);
    }

    if (fields.length === 0) {
      const user = this.findById(id);
      return user ? this.toSafeData(user) : null;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    
    if (result.changes === 0) return null;

    const user = this.findById(id);
    return user ? this.toSafeData(user) : null;
  }

  /**
   * Check if user has manager role
   */
  isManager(user: User): boolean {
    return user.role === 'manager' || user.role === 'both';
  }

  /**
   * Check if user has employee role
   */
  isEmployee(user: User): boolean {
    return user.role === 'employee' || user.role === 'both';
  }

  /**
   * Get all users with specific role
   */
  findByRole(role: UserRole): UserSafeData[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE role = ? OR role = \'both\'');
    const rows = stmt.all(role) as any[];
    
    return rows.map(row => this.toSafeData(this.mapRowToUser(row)));
  }

  /**
   * Search users by name or email
   */
  search(query: string): UserSafeData[] {
    const searchTerm = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM users 
      WHERE email LIKE ? 
         OR first_name LIKE ? 
         OR last_name LIKE ?
         OR (first_name || ' ' || last_name) LIKE ?
      ORDER BY last_name, first_name
    `);
    
    const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm) as any[];
    return rows.map(row => this.toSafeData(this.mapRowToUser(row)));
  }

  /**
   * Generate new verification token
   */
  generateNewVerificationToken(userId: number): string {
    const token = this.generateVerificationToken();
    
    const stmt = this.db.prepare(`
      UPDATE users 
      SET verification_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(token, userId);
    return token;
  }

  // Private helper methods

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
  }

  private validateRole(role: string): void {
    const validRoles: UserRole[] = ['manager', 'employee', 'both'];
    if (!validRoles.includes(role as UserRole)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
  }

  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      emailVerified: Boolean(row.email_verified),
      verificationToken: row.verification_token,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private toSafeData(user: User): UserSafeData {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
