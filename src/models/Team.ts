/**
 * Team Model
 * Handles team creation, member management, and team-level operations
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';
import { User, UserSafeData } from './User';

export interface Team {
  id: number;
  name: string;
  description?: string;
  managerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamWithDetails extends Team {
  manager: UserSafeData;
  memberCount: number;
  members?: TeamMemberWithUser[];
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  joinedAt: Date;
  roleInTeam: string;
}

export interface TeamMemberWithUser extends TeamMember {
  user: UserSafeData;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  managerId: number;
  memberIds: number[];
}

export interface TeamPerformanceSummary {
  teamId: number;
  teamName: string;
  totalMembers: number;
  membersWithKPIs: number;
  averageScore: number;
  completionRate: number;
}

export class TeamModel {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new team with initial members
   */
  create(teamData: CreateTeamData): TeamWithDetails {
    const { name, description, managerId, memberIds } = teamData;

    // Validate manager exists and has manager role
    const manager = this.validateManager(managerId);

    // Validate team name is unique for this manager
    if (this.findByNameAndManager(name, managerId)) {
      throw new Error('Team name already exists for this manager');
    }

    // Validate all member IDs exist and are employees
    this.validateMembers(memberIds);

    // Use transaction for team creation and member assignment
    const transaction = this.db.transaction(() => {
      // Create team
      const teamStmt = this.db.prepare(`
        INSERT INTO teams (name, description, manager_id)
        VALUES (?, ?, ?)
      `);
      
      const result = teamStmt.run(name, description || null, managerId);
      const teamId = result.lastInsertRowid as number;

      // Add members
      if (memberIds.length > 0) {
        this.addMembersToTeam(teamId, memberIds);
      }

      return teamId;
    });

    const teamId = transaction();
    const team = this.findById(teamId);
    
    if (!team) {
      throw new Error('Failed to create team');
    }

    return team;
  }

  /**
   * Find team by ID with full details
   */
  findById(id: number): TeamWithDetails | null {
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        u.id as manager_id, u.email as manager_email, 
        u.first_name as manager_first_name, u.last_name as manager_last_name,
        u.role as manager_role, u.email_verified as manager_email_verified,
        u.created_at as manager_created_at, u.updated_at as manager_updated_at,
        COUNT(tm.id) as member_count
      FROM teams t
      JOIN users u ON t.manager_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.id = ?
      GROUP BY t.id
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToTeamWithDetails(row);
  }

  /**
   * Find team by name and manager
   */
  findByNameAndManager(name: string, managerId: number): Team | null {
    const stmt = this.db.prepare(`
      SELECT * FROM teams 
      WHERE name = ? AND manager_id = ?
    `);

    const row = stmt.get(name, managerId) as any;
    if (!row) return null;

    return this.mapRowToTeam(row);
  }

  /**
   * Get all teams managed by a specific user
   */
  findByManager(managerId: number): TeamWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        u.id as manager_id, u.email as manager_email, 
        u.first_name as manager_first_name, u.last_name as manager_last_name,
        u.role as manager_role, u.email_verified as manager_email_verified,
        u.created_at as manager_created_at, u.updated_at as manager_updated_at,
        COUNT(tm.id) as member_count
      FROM teams t
      JOIN users u ON t.manager_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.manager_id = ?
      GROUP BY t.id
      ORDER BY t.name
    `);

    const rows = stmt.all(managerId) as any[];
    return rows.map(row => this.mapRowToTeamWithDetails(row));
  }

  /**
   * Get team members with user details
   */
  getMembers(teamId: number): TeamMemberWithUser[] {
    const stmt = this.db.prepare(`
      SELECT 
        tm.*,
        u.id as user_id, u.email as user_email,
        u.first_name as user_first_name, u.last_name as user_last_name,
        u.role as user_role, u.email_verified as user_email_verified,
        u.created_at as user_created_at, u.updated_at as user_updated_at
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY u.last_name, u.first_name
    `);

    const rows = stmt.all(teamId) as any[];
    return rows.map(row => this.mapRowToTeamMemberWithUser(row));
  }

  /**
   * Add members to a team
   */
  addMembers(teamId: number, userIds: number[]): void {
    // Validate team exists and get manager
    const team = this.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Validate users exist and are employees
    this.validateMembers(userIds);

    // Check for existing memberships
    const existingMembers = this.getExistingMemberships(teamId, userIds);
    if (existingMembers.length > 0) {
      throw new Error(`Users ${existingMembers.join(', ')} are already team members`);
    }

    this.addMembersToTeam(teamId, userIds);
  }

  /**
   * Remove member from team
   */
  removeMember(teamId: number, userId: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM team_members 
      WHERE team_id = ? AND user_id = ?
    `);

    const result = stmt.run(teamId, userId);
    return result.changes > 0;
  }

  /**
   * Update team details
   */
  update(teamId: number, updates: Partial<Pick<Team, 'name' | 'description'>>): TeamWithDetails | null {
    const fields = [];
    const values = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (fields.length === 0) {
      return this.findById(teamId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(teamId);

    const stmt = this.db.prepare(`
      UPDATE teams 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    
    if (result.changes === 0) return null;

    return this.findById(teamId);
  }

  /**
   * Delete team and all memberships
   */
  delete(teamId: number): boolean {
    const stmt = this.db.prepare('DELETE FROM teams WHERE id = ?');
    const result = stmt.run(teamId);
    return result.changes > 0;
  }

  /**
   * Check if user is member of team
   */
  isMember(teamId: number, userId: number): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM team_members 
      WHERE team_id = ? AND user_id = ?
    `);

    return stmt.get(teamId, userId) !== undefined;
  }

  /**
   * Get teams that a user belongs to
   */
  findByMember(userId: number): TeamWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        u.id as manager_id, u.email as manager_email, 
        u.first_name as manager_first_name, u.last_name as manager_last_name,
        u.role as manager_role, u.email_verified as manager_email_verified,
        u.created_at as manager_created_at, u.updated_at as manager_updated_at,
        COUNT(tm2.id) as member_count
      FROM teams t
      JOIN users u ON t.manager_id = u.id
      JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_members tm2 ON t.id = tm2.team_id
      WHERE tm.user_id = ?
      GROUP BY t.id
      ORDER BY t.name
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map(row => this.mapRowToTeamWithDetails(row));
  }

  /**
   * Get team performance summary
   */
  getPerformanceSummary(teamId: number): TeamPerformanceSummary | null {
    const stmt = this.db.prepare(`
      SELECT 
        t.id as team_id,
        t.name as team_name,
        COUNT(DISTINCT tm.user_id) as total_members,
        COUNT(DISTINCT ki.user_id) as members_with_kpis,
        AVG(pr.score) as average_score,
        (COUNT(DISTINCT CASE WHEN pr.id IS NOT NULL THEN ki.id END) * 100.0 / COUNT(DISTINCT ki.id)) as completion_rate
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN kpi_instances ki ON tm.user_id = ki.user_id AND ki.is_active = TRUE
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE t.id = ?
      GROUP BY t.id
    `);

    const row = stmt.get(teamId) as any;
    if (!row) return null;

    return {
      teamId: row.team_id,
      teamName: row.team_name,
      totalMembers: row.total_members || 0,
      membersWithKPIs: row.members_with_kpis || 0,
      averageScore: row.average_score || 0,
      completionRate: row.completion_rate || 0
    };
  }

  // Private helper methods

  private validateManager(managerId: number): UserSafeData {
    const userStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const userRow = userStmt.get(managerId) as any;
    
    if (!userRow) {
      throw new Error('Manager not found');
    }

    if (userRow.role !== 'manager' && userRow.role !== 'both') {
      throw new Error('User must have manager role');
    }

    return {
      id: userRow.id,
      email: userRow.email,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      role: userRow.role,
      emailVerified: Boolean(userRow.email_verified),
      createdAt: new Date(userRow.created_at),
      updatedAt: new Date(userRow.updated_at)
    };
  }

  private validateMembers(memberIds: number[]): void {
    if (memberIds.length === 0) return;

    const placeholders = memberIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT id, role FROM users 
      WHERE id IN (${placeholders}) AND (role = 'employee' OR role = 'both')
    `);

    const validMembers = stmt.all(...memberIds) as any[];
    const validIds = validMembers.map(m => m.id);
    const invalidIds = memberIds.filter(id => !validIds.includes(id));

    if (invalidIds.length > 0) {
      throw new Error(`Invalid member IDs: ${invalidIds.join(', ')}`);
    }
  }

  private getExistingMemberships(teamId: number, userIds: number[]): number[] {
    if (userIds.length === 0) return [];

    const placeholders = userIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT user_id FROM team_members 
      WHERE team_id = ? AND user_id IN (${placeholders})
    `);

    const existing = stmt.all(teamId, ...userIds) as any[];
    return existing.map(row => row.user_id);
  }

  private addMembersToTeam(teamId: number, userIds: number[]): void {
    if (userIds.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO team_members (team_id, user_id, role_in_team)
      VALUES (?, ?, 'member')
    `);

    for (const userId of userIds) {
      stmt.run(teamId, userId);
    }
  }

  private mapRowToTeam(row: any): Team {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      managerId: row.manager_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToTeamWithDetails(row: any): TeamWithDetails {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      managerId: row.manager_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      manager: {
        id: row.manager_id,
        email: row.manager_email,
        firstName: row.manager_first_name,
        lastName: row.manager_last_name,
        role: row.manager_role,
        emailVerified: Boolean(row.manager_email_verified),
        createdAt: new Date(row.manager_created_at),
        updatedAt: new Date(row.manager_updated_at)
      },
      memberCount: row.member_count || 0
    };
  }

  private mapRowToTeamMemberWithUser(row: any): TeamMemberWithUser {
    return {
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      joinedAt: new Date(row.joined_at),
      roleInTeam: row.role_in_team,
      user: {
        id: row.user_id,
        email: row.user_email,
        firstName: row.user_first_name,
        lastName: row.user_last_name,
        role: row.user_role,
        emailVerified: Boolean(row.user_email_verified),
        createdAt: new Date(row.user_created_at),
        updatedAt: new Date(row.user_updated_at)
      }
    };
  }
}
