/**
 * KPIInstance Model
 * Handles individual KPI instances assigned to users
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';

export interface KPIInstance {
  id: number;
  definitionId: number;
  userId: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIInstanceWithDetails extends KPIInstance {
  definitionName: string;
  definitionDescription?: string;
  definitionTargetValue: number;
  definitionWeight: number;
  definitionFrequency: string;
  groupName: string;
  groupWeight: number;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  recordCount: number;
  currentScore: number | null;
  lastUpdated: Date | null;
}

export interface CreateKPIInstanceData {
  definitionId: number;
  userId: number;
  startDate: Date;
  endDate: Date;
}

export interface KPIInstanceProgress {
  instanceId: number;
  instanceName: string;
  targetValue: number;
  currentValue: number | null;
  currentScore: number | null;
  progressPercentage: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
  daysRemaining: number;
  lastUpdated: Date | null;
}

export interface UserKPIPortfolio {
  userId: number;
  userName: string;
  totalInstances: number;
  activeInstances: number;
  completedInstances: number;
  overdueInstances: number;
  averageScore: number;
  instances: KPIInstanceWithDetails[];
}

export class KPIInstanceModel {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new KPI instance
   */
  create(instanceData: CreateKPIInstanceData): KPIInstanceWithDetails {
    const { definitionId, userId, startDate, endDate } = instanceData;

    // Validate definition exists and is active
    this.validateDefinition(definitionId);

    // Validate user exists and has appropriate role
    this.validateUser(userId);

    // Validate date range
    this.validateDateRange(startDate, endDate);

    // Check for overlapping instances
    if (this.hasOverlappingInstance(definitionId, userId, startDate, endDate)) {
      throw new Error('User already has an active KPI instance for this definition in the given time period');
    }

    const stmt = this.db.prepare(`
      INSERT INTO kpi_instances (definition_id, user_id, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `);

    const result = stmt.run(definitionId, userId, startDate.toISOString(), endDate.toISOString());
    const instanceId = result.lastInsertRowid as number;

    const instance = this.findById(instanceId);
    if (!instance) {
      throw new Error('Failed to create KPI instance');
    }

    return instance;
  }

  /**
   * Find KPI instance by ID with full details
   */
  findById(id: number): KPIInstanceWithDetails | null {
    const stmt = this.db.prepare(`
      SELECT 
        ki.*,
        kd.name as definition_name,
        kd.description as definition_description,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kd.frequency as definition_frequency,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        COUNT(pr.id) as record_count,
        AVG(pr.score) as current_score,
        MAX(pr.created_at) as last_updated
      FROM kpi_instances ki
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE ki.id = ?
      GROUP BY ki.id
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToKPIInstanceWithDetails(row);
  }

  /**
   * Get all KPI instances for a user
   */
  findByUser(userId: number, includeInactive: boolean = false): KPIInstanceWithDetails[] {
    const activeClause = includeInactive ? '' : 'AND ki.is_active = TRUE';
    
    const stmt = this.db.prepare(`
      SELECT 
        ki.*,
        kd.name as definition_name,
        kd.description as definition_description,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kd.frequency as definition_frequency,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        COUNT(pr.id) as record_count,
        AVG(pr.score) as current_score,
        MAX(pr.created_at) as last_updated
      FROM kpi_instances ki
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE ki.user_id = ? ${activeClause}
      GROUP BY ki.id
      ORDER BY ki.end_date DESC, kg.name, kd.name
    `);

    const rows = stmt.all(userId) as any[];
    return rows.map(row => this.mapRowToKPIInstanceWithDetails(row));
  }

  /**
   * Get all instances for a KPI definition
   */
  findByDefinition(definitionId: number): KPIInstanceWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        ki.*,
        kd.name as definition_name,
        kd.description as definition_description,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kd.frequency as definition_frequency,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        COUNT(pr.id) as record_count,
        AVG(pr.score) as current_score,
        MAX(pr.created_at) as last_updated
      FROM kpi_instances ki
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE ki.definition_id = ?
      GROUP BY ki.id
      ORDER BY ki.end_date DESC, u.last_name, u.first_name
    `);

    const rows = stmt.all(definitionId) as any[];
    return rows.map(row => this.mapRowToKPIInstanceWithDetails(row));
  }

  /**
   * Get active instances within date range
   */
  findActiveInDateRange(startDate: Date, endDate: Date): KPIInstanceWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        ki.*,
        kd.name as definition_name,
        kd.description as definition_description,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kd.frequency as definition_frequency,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        COUNT(pr.id) as record_count,
        AVG(pr.score) as current_score,
        MAX(pr.created_at) as last_updated
      FROM kpi_instances ki
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE ki.is_active = TRUE
        AND ki.start_date <= ?
        AND ki.end_date >= ?
      GROUP BY ki.id
      ORDER BY ki.end_date, kg.name, kd.name
    `);

    const rows = stmt.all(endDate.toISOString(), startDate.toISOString()) as any[];
    return rows.map(row => this.mapRowToKPIInstanceWithDetails(row));
  }

  /**
   * Update KPI instance dates
   */
  updateDates(instanceId: number, startDate: Date, endDate: Date): KPIInstanceWithDetails | null {
    this.validateDateRange(startDate, endDate);

    // Get current instance to check for overlaps
    const currentInstance = this.findById(instanceId);
    if (!currentInstance) return null;

    // Check for overlapping instances (excluding current)
    if (this.hasOverlappingInstanceExcluding(currentInstance.definitionId, currentInstance.userId, startDate, endDate, instanceId)) {
      throw new Error('Date update would create overlapping KPI instances');
    }

    const stmt = this.db.prepare(`
      UPDATE kpi_instances 
      SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(startDate.toISOString(), endDate.toISOString(), instanceId);
    
    if (result.changes === 0) return null;

    return this.findById(instanceId);
  }

  /**
   * Deactivate KPI instance
   */
  deactivate(instanceId: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE kpi_instances 
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(instanceId);
    return result.changes > 0;
  }

  /**
   * Reactivate KPI instance
   */
  reactivate(instanceId: number): KPIInstanceWithDetails | null {
    const stmt = this.db.prepare(`
      UPDATE kpi_instances 
      SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(instanceId);
    
    if (result.changes === 0) return null;

    return this.findById(instanceId);
  }

  /**
   * Get KPI instance progress details
   */
  getProgress(instanceId: number): KPIInstanceProgress | null {
    const instance = this.findById(instanceId);
    if (!instance) return null;

    const now = new Date();
    const daysRemaining = Math.ceil((instance.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
    if (now < instance.startDate) {
      status = 'not-started';
    } else if (now > instance.endDate) {
      status = 'overdue';
    } else if (instance.currentScore !== null && instance.currentScore >= instance.definitionTargetValue) {
      status = 'completed';
    } else {
      status = 'in-progress';
    }

    const progressPercentage = instance.currentScore !== null 
      ? Math.min(100, (instance.currentScore / instance.definitionTargetValue) * 100)
      : 0;

    return {
      instanceId: instance.id,
      instanceName: instance.definitionName,
      targetValue: instance.definitionTargetValue,
      currentValue: instance.currentScore,
      currentScore: instance.currentScore,
      progressPercentage,
      status,
      daysRemaining,
      lastUpdated: instance.lastUpdated
    };
  }

  /**
   * Get user's complete KPI portfolio
   */
  getUserPortfolio(userId: number): UserKPIPortfolio | null {
    const instances = this.findByUser(userId, true);
    if (instances.length === 0) return null;

    const now = new Date();
    const activeInstances = instances.filter(i => i.isActive);
    const completedInstances = instances.filter(i => 
      i.currentScore !== null && i.currentScore >= i.definitionTargetValue
    );
    const overdueInstances = instances.filter(i => 
      i.isActive && now > i.endDate && (i.currentScore === null || i.currentScore < i.definitionTargetValue)
    );

    const scoresWithValues = instances
      .map(i => i.currentScore)
      .filter(score => score !== null) as number[];
    
    const averageScore = scoresWithValues.length > 0 
      ? scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length
      : 0;

    const firstInstance = instances[0];

    return {
      userId,
      userName: `${firstInstance.userFirstName} ${firstInstance.userLastName}`,
      totalInstances: instances.length,
      activeInstances: activeInstances.length,
      completedInstances: completedInstances.length,
      overdueInstances: overdueInstances.length,
      averageScore,
      instances
    };
  }

  /**
   * Get instances expiring soon (within specified days)
   */
  findExpiringSoon(days: number = 7): KPIInstanceWithDetails[] {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const stmt = this.db.prepare(`
      SELECT 
        ki.*,
        kd.name as definition_name,
        kd.description as definition_description,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kd.frequency as definition_frequency,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        COUNT(pr.id) as record_count,
        AVG(pr.score) as current_score,
        MAX(pr.created_at) as last_updated
      FROM kpi_instances ki
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE ki.is_active = TRUE
        AND ki.end_date <= ?
        AND ki.end_date >= CURRENT_DATE
      GROUP BY ki.id
      ORDER BY ki.end_date, u.last_name, u.first_name
    `);

    const rows = stmt.all(targetDate.toISOString()) as any[];
    return rows.map(row => this.mapRowToKPIInstanceWithDetails(row));
  }

  // Private helper methods

  private validateDefinition(definitionId: number): void {
    const stmt = this.db.prepare('SELECT is_active FROM kpi_definitions WHERE id = ?');
    const definition = stmt.get(definitionId) as any;

    if (!definition) {
      throw new Error('KPI definition not found');
    }

    if (!definition.is_active) {
      throw new Error('Cannot create instance for inactive KPI definition');
    }
  }

  private validateUser(userId: number): void {
    const stmt = this.db.prepare('SELECT role FROM users WHERE id = ?');
    const user = stmt.get(userId) as any;

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'employee' && user.role !== 'both') {
      throw new Error('KPI instances can only be assigned to employees');
    }
  }

  private validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time for date comparison

    if (endDate < now) {
      throw new Error('End date cannot be in the past');
    }
  }

  private hasOverlappingInstance(definitionId: number, userId: number, startDate: Date, endDate: Date): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM kpi_instances
      WHERE definition_id = ? AND user_id = ? AND is_active = TRUE
        AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))
    `);

    const result = stmt.get(
      definitionId, userId,
      startDate.toISOString(), startDate.toISOString(),
      endDate.toISOString(), endDate.toISOString()
    ) as any;

    return result.count > 0;
  }

  private hasOverlappingInstanceExcluding(definitionId: number, userId: number, startDate: Date, endDate: Date, excludeId: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM kpi_instances
      WHERE definition_id = ? AND user_id = ? AND is_active = TRUE AND id != ?
        AND ((start_date <= ? AND end_date >= ?) OR (start_date <= ? AND end_date >= ?))
    `);

    const result = stmt.get(
      definitionId, userId, excludeId,
      startDate.toISOString(), startDate.toISOString(),
      endDate.toISOString(), endDate.toISOString()
    ) as any;

    return result.count > 0;
  }

  private mapRowToKPIInstanceWithDetails(row: any): KPIInstanceWithDetails {
    return {
      id: row.id,
      definitionId: row.definition_id,
      userId: row.user_id,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      definitionName: row.definition_name,
      definitionDescription: row.definition_description,
      definitionTargetValue: row.definition_target_value,
      definitionWeight: row.definition_weight,
      definitionFrequency: row.definition_frequency,
      groupName: row.group_name,
      groupWeight: row.group_weight,
      userEmail: row.user_email,
      userFirstName: row.user_first_name,
      userLastName: row.user_last_name,
      recordCount: row.record_count || 0,
      currentScore: row.current_score,
      lastUpdated: row.last_updated ? new Date(row.last_updated) : null
    };
  }
}
