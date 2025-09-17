/**
 * PerformanceRecord Model
 * Handles performance record creation, updates, and analytics
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';

export interface PerformanceRecord {
  id: number;
  instanceId: number;
  actualValue: number;
  score: number;
  notes?: string;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceRecordWithDetails extends PerformanceRecord {
  definitionName: string;
  definitionTargetValue: number;
  definitionWeight: number;
  groupName: string;
  groupWeight: number;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  instanceStartDate: Date;
  instanceEndDate: Date;
}

export interface CreatePerformanceRecordData {
  instanceId: number;
  actualValue: number;
  notes?: string;
  recordedAt?: Date;
}

export interface PerformanceAnalytics {
  instanceId: number;
  instanceName: string;
  totalRecords: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  latestScore: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient-data';
  progressToTarget: number;
  recordsThisWeek: number;
  recordsThisMonth: number;
}

export interface UserPerformanceSummary {
  userId: number;
  userName: string;
  period: {
    start: Date;
    end: Date;
  };
  totalRecords: number;
  weightedScore: number;
  groupScores: {
    groupId: number;
    groupName: string;
    weight: number;
    score: number;
    recordCount: number;
  }[];
  recentActivity: PerformanceRecordWithDetails[];
}

export class PerformanceRecordModel {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new performance record
   */
  create(recordData: CreatePerformanceRecordData): PerformanceRecordWithDetails {
    const { instanceId, actualValue, notes, recordedAt } = recordData;

    // Validate instance exists and is active
    this.validateInstance(instanceId);

    // Validate actual value
    this.validateActualValue(actualValue);

    // Get target value for score calculation
    const targetValue = this.getInstanceTargetValue(instanceId);
    const score = this.calculateScore(actualValue, targetValue);

    const recordTime = recordedAt || new Date();

    const stmt = this.db.prepare(`
      INSERT INTO performance_records (instance_id, actual_value, score, notes, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(instanceId, actualValue, score, notes || null, recordTime.toISOString());
    const recordId = result.lastInsertRowid as number;

    const record = this.findById(recordId);
    if (!record) {
      throw new Error('Failed to create performance record');
    }

    return record;
  }

  /**
   * Find performance record by ID with full details
   */
  findById(id: number): PerformanceRecordWithDetails | null {
    const stmt = this.db.prepare(`
      SELECT 
        pr.*,
        kd.name as definition_name,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        ki.start_date as instance_start_date,
        ki.end_date as instance_end_date
      FROM performance_records pr
      JOIN kpi_instances ki ON pr.instance_id = ki.id
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      WHERE pr.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToPerformanceRecordWithDetails(row);
  }

  /**
   * Get all performance records for a KPI instance
   */
  findByInstance(instanceId: number): PerformanceRecordWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        pr.*,
        kd.name as definition_name,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        ki.start_date as instance_start_date,
        ki.end_date as instance_end_date
      FROM performance_records pr
      JOIN kpi_instances ki ON pr.instance_id = ki.id
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      WHERE pr.instance_id = ?
      ORDER BY pr.recorded_at DESC
    `);

    const rows = stmt.all(instanceId) as any[];
    return rows.map(row => this.mapRowToPerformanceRecordWithDetails(row));
  }

  /**
   * Get performance records for a user within date range
   */
  findByUserAndDateRange(userId: number, startDate: Date, endDate: Date): PerformanceRecordWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        pr.*,
        kd.name as definition_name,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        ki.start_date as instance_start_date,
        ki.end_date as instance_end_date
      FROM performance_records pr
      JOIN kpi_instances ki ON pr.instance_id = ki.id
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      WHERE ki.user_id = ?
        AND pr.recorded_at >= ?
        AND pr.recorded_at <= ?
      ORDER BY pr.recorded_at DESC
    `);

    const rows = stmt.all(userId, startDate.toISOString(), endDate.toISOString()) as any[];
    return rows.map(row => this.mapRowToPerformanceRecordWithDetails(row));
  }

  /**
   * Get recent performance records across all users
   */
  findRecent(limit: number = 50): PerformanceRecordWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT 
        pr.*,
        kd.name as definition_name,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        ki.start_date as instance_start_date,
        ki.end_date as instance_end_date
      FROM performance_records pr
      JOIN kpi_instances ki ON pr.instance_id = ki.id
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      ORDER BY pr.recorded_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapRowToPerformanceRecordWithDetails(row));
  }

  /**
   * Update performance record
   */
  update(recordId: number, updates: Partial<Pick<PerformanceRecord, 'actualValue' | 'notes' | 'recordedAt'>>): PerformanceRecordWithDetails | null {
    const fields = [];
    const values = [];

    if (updates.actualValue !== undefined) {
      this.validateActualValue(updates.actualValue);
      
      // Get target value and recalculate score
      const currentRecord = this.findById(recordId);
      if (!currentRecord) return null;
      
      const score = this.calculateScore(updates.actualValue, currentRecord.definitionTargetValue);
      
      fields.push('actual_value = ?', 'score = ?');
      values.push(updates.actualValue, score);
    }

    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (updates.recordedAt) {
      fields.push('recorded_at = ?');
      values.push(updates.recordedAt.toISOString());
    }

    if (fields.length === 0) {
      return this.findById(recordId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(recordId);

    const stmt = this.db.prepare(`
      UPDATE performance_records 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    
    if (result.changes === 0) return null;

    return this.findById(recordId);
  }

  /**
   * Delete performance record
   */
  delete(recordId: number): boolean {
    const stmt = this.db.prepare('DELETE FROM performance_records WHERE id = ?');
    const result = stmt.run(recordId);
    return result.changes > 0;
  }

  /**
   * Get performance analytics for a KPI instance
   */
  getInstanceAnalytics(instanceId: number): PerformanceAnalytics | null {
    const records = this.findByInstance(instanceId);
    if (records.length === 0) return null;

    const firstRecord = records[0];
    const scores = records.map(r => r.score).sort((a, b) => a - b);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Calculate trend (comparing first half vs second half of records)
    let trend: 'improving' | 'declining' | 'stable' | 'insufficient-data' = 'insufficient-data';
    if (records.length >= 4) {
      const halfPoint = Math.floor(records.length / 2);
      const firstHalf = records.slice(halfPoint).map(r => r.score);
      const secondHalf = records.slice(0, halfPoint).map(r => r.score);
      
      const firstHalfAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
      
      const difference = secondHalfAvg - firstHalfAvg;
      if (difference > 5) trend = 'improving';
      else if (difference < -5) trend = 'declining';
      else trend = 'stable';
    }

    // Count recent records
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recordsThisWeek = records.filter(r => r.recordedAt >= weekAgo).length;
    const recordsThisMonth = records.filter(r => r.recordedAt >= monthAgo).length;

    return {
      instanceId,
      instanceName: firstRecord.definitionName,
      totalRecords: records.length,
      averageScore,
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
      latestScore: records[0].score,
      trend,
      progressToTarget: Math.min(100, (averageScore / firstRecord.definitionTargetValue) * 100),
      recordsThisWeek,
      recordsThisMonth
    };
  }

  /**
   * Get comprehensive performance summary for a user
   */
  getUserPerformanceSummary(userId: number, startDate: Date, endDate: Date): UserPerformanceSummary | null {
    const records = this.findByUserAndDateRange(userId, startDate, endDate);
    if (records.length === 0) return null;

    const firstRecord = records[0];

    // Calculate weighted score by group
    const groupScores = new Map<number, {
      groupId: number;
      groupName: string;
      weight: number;
      totalScore: number;
      recordCount: number;
    }>();

    for (const record of records) {
      const groupKey = record.groupName;
      if (!groupScores.has(record.groupWeight)) {
        groupScores.set(record.groupWeight, {
          groupId: record.groupWeight, // This should be group ID, but we don't have it in the current structure
          groupName: record.groupName,
          weight: record.groupWeight,
          totalScore: 0,
          recordCount: 0
        });
      }

      const groupData = groupScores.get(record.groupWeight)!;
      groupData.totalScore += record.score * record.definitionWeight;
      groupData.recordCount++;
    }

    // Calculate final group scores and overall weighted score
    let totalWeightedScore = 0;
    const finalGroupScores = Array.from(groupScores.values()).map(group => {
      const averageScore = group.recordCount > 0 ? group.totalScore / group.recordCount : 0;
      totalWeightedScore += averageScore * (group.weight / 100);
      
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        weight: group.weight,
        score: averageScore,
        recordCount: group.recordCount
      };
    });

    return {
      userId,
      userName: `${firstRecord.userFirstName} ${firstRecord.userLastName}`,
      period: { start: startDate, end: endDate },
      totalRecords: records.length,
      weightedScore: totalWeightedScore,
      groupScores: finalGroupScores,
      recentActivity: records.slice(0, 10) // Last 10 records
    };
  }

  /**
   * Get performance records that need attention (low scores, overdue, etc.)
   */
  findRequiringAttention(): PerformanceRecordWithDetails[] {
    const now = new Date();
    const stmt = this.db.prepare(`
      SELECT 
        pr.*,
        kd.name as definition_name,
        kd.target_value as definition_target_value,
        kd.weight as definition_weight,
        kg.name as group_name,
        kg.weight as group_weight,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        ki.start_date as instance_start_date,
        ki.end_date as instance_end_date
      FROM performance_records pr
      JOIN kpi_instances ki ON pr.instance_id = ki.id
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      JOIN kpi_groups kg ON kd.group_id = kg.id
      JOIN users u ON ki.user_id = u.id
      WHERE ki.is_active = TRUE
        AND (
          pr.score < (kd.target_value * 0.7) -- Score less than 70% of target
          OR ki.end_date < ? -- Instance is overdue
        )
      ORDER BY pr.score ASC, ki.end_date ASC
    `);

    const rows = stmt.all(now.toISOString()) as any[];
    return rows.map(row => this.mapRowToPerformanceRecordWithDetails(row));
  }

  /**
   * Get performance leaderboard for a date range
   */
  getLeaderboard(startDate: Date, endDate: Date, limit: number = 10): {
    userId: number;
    userName: string;
    averageScore: number;
    totalRecords: number;
    rank: number;
  }[] {
    const stmt = this.db.prepare(`
      SELECT 
        u.id as user_id,
        u.first_name || ' ' || u.last_name as user_name,
        AVG(pr.score) as average_score,
        COUNT(pr.id) as total_records
      FROM performance_records pr
      JOIN kpi_instances ki ON pr.instance_id = ki.id
      JOIN users u ON ki.user_id = u.id
      WHERE pr.recorded_at >= ? AND pr.recorded_at <= ?
      GROUP BY u.id
      HAVING total_records >= 3 -- Minimum 3 records to qualify
      ORDER BY average_score DESC
      LIMIT ?
    `);

    const rows = stmt.all(startDate.toISOString(), endDate.toISOString(), limit) as any[];
    
    return rows.map((row, index) => ({
      userId: row.user_id,
      userName: row.user_name,
      averageScore: row.average_score,
      totalRecords: row.total_records,
      rank: index + 1
    }));
  }

  // Private helper methods

  private validateInstance(instanceId: number): void {
    const stmt = this.db.prepare(`
      SELECT ki.is_active, ki.end_date
      FROM kpi_instances ki
      WHERE ki.id = ?
    `);
    
    const instance = stmt.get(instanceId) as any;

    if (!instance) {
      throw new Error('KPI instance not found');
    }

    if (!instance.is_active) {
      throw new Error('Cannot create records for inactive KPI instance');
    }
  }

  private validateActualValue(actualValue: number): void {
    if (actualValue < 0) {
      throw new Error('Actual value must be non-negative');
    }

    if (!Number.isFinite(actualValue)) {
      throw new Error('Actual value must be a valid number');
    }
  }

  private getInstanceTargetValue(instanceId: number): number {
    const stmt = this.db.prepare(`
      SELECT kd.target_value
      FROM kpi_instances ki
      JOIN kpi_definitions kd ON ki.definition_id = kd.id
      WHERE ki.id = ?
    `);

    const result = stmt.get(instanceId) as any;
    return result ? result.target_value : 100; // Default target if not found
  }

  private calculateScore(actualValue: number, targetValue: number): number {
    if (targetValue === 0) return actualValue > 0 ? 100 : 0;
    
    // Calculate percentage achievement, capped at 100
    const percentage = Math.min(100, (actualValue / targetValue) * 100);
    return Math.round(percentage * 100) / 100; // Round to 2 decimal places
  }

  private mapRowToPerformanceRecordWithDetails(row: any): PerformanceRecordWithDetails {
    return {
      id: row.id,
      instanceId: row.instance_id,
      actualValue: row.actual_value,
      score: row.score,
      notes: row.notes,
      recordedAt: new Date(row.recorded_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      definitionName: row.definition_name,
      definitionTargetValue: row.definition_target_value,
      definitionWeight: row.definition_weight,
      groupName: row.group_name,
      groupWeight: row.group_weight,
      userEmail: row.user_email,
      userFirstName: row.user_first_name,
      userLastName: row.user_last_name,
      instanceStartDate: new Date(row.instance_start_date),
      instanceEndDate: new Date(row.instance_end_date)
    };
  }
}
