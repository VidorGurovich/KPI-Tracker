/**
 * KPIGroup Model
 * Handles KPI group creation, management, and operations
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';

export interface KPIGroup {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIGroupWithKPIs extends KPIGroup {
  kpiCount: number;
  kpiDefinitions?: KPIDefinitionSummary[];
}

export interface KPIDefinitionSummary {
  id: number;
  name: string;
  description?: string;
  targetValue: number;
  weight: number;
  isActive: boolean;
}

export interface CreateKPIGroupData {
  name: string;
  description?: string;
  weight: number;
}

export interface KPIGroupValidationResult {
  isValid: boolean;
  errors: string[];
  totalWeight: number;
  groupWeights: { [groupId: number]: number };
}

export class KPIGroupModel {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new KPI group
   */
  create(groupData: CreateKPIGroupData): KPIGroupWithKPIs {
    const { name, description, weight } = groupData;

    // Validate group name is unique
    if (this.findByName(name)) {
      throw new Error('KPI group name already exists');
    }

    // Validate weight constraints
    this.validateWeight(weight);
    this.validateTotalWeightForNewGroup(weight);

    const stmt = this.db.prepare(`
      INSERT INTO kpi_groups (name, description, weight, is_default)
      VALUES (?, ?, ?, FALSE)
    `);

    const result = stmt.run(name, description || null, weight);
    const groupId = result.lastInsertRowid as number;

    const group = this.findById(groupId);
    if (!group) {
      throw new Error('Failed to create KPI group');
    }

    return group;
  }

  /**
   * Find KPI group by ID with KPI count
   */
  findById(id: number): KPIGroupWithKPIs | null {
    const stmt = this.db.prepare(`
      SELECT 
        kg.*,
        COUNT(kd.id) as kpi_count
      FROM kpi_groups kg
      LEFT JOIN kpi_definitions kd ON kg.id = kd.group_id AND kd.is_active = TRUE
      WHERE kg.id = ?
      GROUP BY kg.id
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToKPIGroupWithKPIs(row);
  }

  /**
   * Find KPI group by name
   */
  findByName(name: string): KPIGroup | null {
    const stmt = this.db.prepare('SELECT * FROM kpi_groups WHERE name = ?');
    const row = stmt.get(name) as any;
    
    if (!row) return null;
    return this.mapRowToKPIGroup(row);
  }

  /**
   * Get all KPI groups with KPI counts
   */
  findAll(): KPIGroupWithKPIs[] {
    const stmt = this.db.prepare(`
      SELECT 
        kg.*,
        COUNT(kd.id) as kpi_count
      FROM kpi_groups kg
      LEFT JOIN kpi_definitions kd ON kg.id = kd.group_id AND kd.is_active = TRUE
      GROUP BY kg.id
      ORDER BY kg.is_default DESC, kg.name
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToKPIGroupWithKPIs(row));
  }

  /**
   * Get default KPI groups
   */
  findDefaults(): KPIGroupWithKPIs[] {
    const stmt = this.db.prepare(`
      SELECT 
        kg.*,
        COUNT(kd.id) as kpi_count
      FROM kpi_groups kg
      LEFT JOIN kpi_definitions kd ON kg.id = kd.group_id AND kd.is_active = TRUE
      WHERE kg.is_default = TRUE
      GROUP BY kg.id
      ORDER BY kg.name
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToKPIGroupWithKPIs(row));
  }

  /**
   * Get KPI group with all its KPI definitions
   */
  findWithKPIDefinitions(id: number): KPIGroupWithKPIs | null {
    const group = this.findById(id);
    if (!group) return null;

    const kpiStmt = this.db.prepare(`
      SELECT id, name, description, target_value, weight, is_active
      FROM kpi_definitions
      WHERE group_id = ? AND is_active = TRUE
      ORDER BY name
    `);

    const kpiRows = kpiStmt.all(id) as any[];
    group.kpiDefinitions = kpiRows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      targetValue: row.target_value,
      weight: row.weight,
      isActive: Boolean(row.is_active)
    }));

    return group;
  }

  /**
   * Update KPI group
   */
  update(groupId: number, updates: Partial<Pick<KPIGroup, 'name' | 'description' | 'weight'>>): KPIGroupWithKPIs | null {
    const fields = [];
    const values = [];

    if (updates.name) {
      // Check name uniqueness
      const existing = this.findByName(updates.name);
      if (existing && existing.id !== groupId) {
        throw new Error('KPI group name already exists');
      }
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.weight !== undefined) {
      this.validateWeight(updates.weight);
      this.validateTotalWeightForUpdate(groupId, updates.weight);
      fields.push('weight = ?');
      values.push(updates.weight);
    }

    if (fields.length === 0) {
      return this.findById(groupId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(groupId);

    const stmt = this.db.prepare(`
      UPDATE kpi_groups 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    
    if (result.changes === 0) return null;

    return this.findById(groupId);
  }

  /**
   * Delete KPI group (only if no KPI definitions exist)
   */
  delete(groupId: number): boolean {
    // Check if group is default
    const group = this.findById(groupId);
    if (!group) return false;

    if (group.isDefault) {
      throw new Error('Cannot delete default KPI groups');
    }

    // Check if has KPI definitions
    const kpiStmt = this.db.prepare('SELECT COUNT(*) as count FROM kpi_definitions WHERE group_id = ?');
    const kpiCount = (kpiStmt.get(groupId) as any).count;

    if (kpiCount > 0) {
      throw new Error('Cannot delete KPI group with existing definitions');
    }

    const stmt = this.db.prepare('DELETE FROM kpi_groups WHERE id = ?');
    const result = stmt.run(groupId);
    return result.changes > 0;
  }

  /**
   * Validate KPI group weights total to 100
   */
  validateWeights(): KPIGroupValidationResult {
    const stmt = this.db.prepare('SELECT id, name, weight FROM kpi_groups ORDER BY name');
    const groups = stmt.all() as any[];

    const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
    const groupWeights = groups.reduce((acc, group) => {
      acc[group.id] = group.weight;
      return acc;
    }, {} as { [groupId: number]: number });

    const errors = [];
    
    if (totalWeight !== 100) {
      errors.push(`Total KPI group weights must equal 100, currently ${totalWeight}`);
    }

    // Check for zero weights
    const zeroWeightGroups = groups.filter(g => g.weight === 0);
    if (zeroWeightGroups.length > 0) {
      errors.push(`Groups with zero weight: ${zeroWeightGroups.map(g => g.name).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      totalWeight,
      groupWeights
    };
  }

  /**
   * Rebalance weights proportionally to total 100
   */
  rebalanceWeights(): KPIGroupValidationResult {
    const groups = this.findAll();
    const currentTotal = groups.reduce((sum, group) => sum + group.weight, 0);

    if (currentTotal === 0) {
      throw new Error('Cannot rebalance when all weights are zero');
    }

    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare('UPDATE kpi_groups SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      
      for (const group of groups) {
        const newWeight = Math.round((group.weight / currentTotal) * 100);
        stmt.run(newWeight, group.id);
      }
    });

    transaction();

    return this.validateWeights();
  }

  /**
   * Get group performance statistics
   */
  getGroupStatistics(groupId: number): {
    groupId: number;
    groupName: string;
    totalKPIs: number;
    activeInstances: number;
    averageScore: number;
    completionRate: number;
  } | null {
    const stmt = this.db.prepare(`
      SELECT 
        kg.id as group_id,
        kg.name as group_name,
        COUNT(DISTINCT kd.id) as total_kpis,
        COUNT(DISTINCT ki.id) as active_instances,
        AVG(pr.score) as average_score,
        (COUNT(DISTINCT pr.id) * 100.0 / COUNT(DISTINCT ki.id)) as completion_rate
      FROM kpi_groups kg
      LEFT JOIN kpi_definitions kd ON kg.id = kd.group_id AND kd.is_active = TRUE
      LEFT JOIN kpi_instances ki ON kd.id = ki.definition_id AND ki.is_active = TRUE
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE kg.id = ?
      GROUP BY kg.id
    `);

    const row = stmt.get(groupId) as any;
    if (!row) return null;

    return {
      groupId: row.group_id,
      groupName: row.group_name,
      totalKPIs: row.total_kpis || 0,
      activeInstances: row.active_instances || 0,
      averageScore: row.average_score || 0,
      completionRate: row.completion_rate || 0
    };
  }

  // Private helper methods

  private validateWeight(weight: number): void {
    if (weight < 0 || weight > 100) {
      throw new Error('Weight must be between 0 and 100');
    }

    if (!Number.isInteger(weight)) {
      throw new Error('Weight must be an integer');
    }
  }

  private validateTotalWeightForNewGroup(newWeight: number): void {
    const stmt = this.db.prepare('SELECT SUM(weight) as total FROM kpi_groups');
    const result = stmt.get() as any;
    const currentTotal = result.total || 0;

    if (currentTotal + newWeight > 100) {
      throw new Error(`Adding weight ${newWeight} would exceed total limit of 100 (current: ${currentTotal})`);
    }
  }

  private validateTotalWeightForUpdate(groupId: number, newWeight: number): void {
    const stmt = this.db.prepare('SELECT SUM(weight) as total FROM kpi_groups WHERE id != ?');
    const result = stmt.get(groupId) as any;
    const otherGroupsTotal = result.total || 0;

    if (otherGroupsTotal + newWeight > 100) {
      throw new Error(`Updating weight to ${newWeight} would exceed total limit of 100 (other groups: ${otherGroupsTotal})`);
    }
  }

  private mapRowToKPIGroup(row: any): KPIGroup {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isDefault: Boolean(row.is_default),
      weight: row.weight,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToKPIGroupWithKPIs(row: any): KPIGroupWithKPIs {
    return {
      ...this.mapRowToKPIGroup(row),
      kpiCount: row.kpi_count || 0
    };
  }
}
