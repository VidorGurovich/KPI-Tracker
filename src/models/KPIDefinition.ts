/**
 * KPIDefinition Model
 * Handles KPI definition creation, management, and template operations
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';

export interface KPIDefinition {
  id: number;
  groupId: number;
  name: string;
  description?: string;
  targetValue: number;
  weight: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIDefinitionWithGroup extends KPIDefinition {
  groupName: string;
  groupWeight: number;
}

export interface CreateKPIDefinitionData {
  groupId: number;
  name: string;
  description?: string;
  targetValue: number;
  weight: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface KPIDefinitionStats {
  definitionId: number;
  definitionName: string;
  activeInstances: number;
  totalRecords: number;
  averageScore: number;
  completionRate: number;
  lastUpdated: Date | null;
}

export interface KPIGroupWeightValidation {
  isValid: boolean;
  errors: string[];
  groupId: number;
  totalWeight: number;
  definitions: { id: number; name: string; weight: number }[];
}

export class KPIDefinitionModel {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new KPI definition
   */
  create(kpiData: CreateKPIDefinitionData): KPIDefinitionWithGroup {
    const { groupId, name, description, targetValue, weight, frequency } = kpiData;

    // Validate group exists
    this.validateGroup(groupId);

    // Validate KPI name is unique within the group
    if (this.findByNameAndGroup(name, groupId)) {
      throw new Error('KPI definition name already exists in this group');
    }

    // Validate weight constraints
    this.validateWeight(weight);
    this.validateGroupWeightForNewKPI(groupId, weight);

    // Validate target value
    this.validateTargetValue(targetValue);

    // Validate frequency
    this.validateFrequency(frequency);

    const stmt = this.db.prepare(`
      INSERT INTO kpi_definitions (group_id, name, description, target_value, weight, frequency, is_active)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `);

    const result = stmt.run(groupId, name, description || null, targetValue, weight, frequency);
    const kpiId = result.lastInsertRowid as number;

    const kpi = this.findById(kpiId);
    if (!kpi) {
      throw new Error('Failed to create KPI definition');
    }

    return kpi;
  }

  /**
   * Find KPI definition by ID with group information
   */
  findById(id: number): KPIDefinitionWithGroup | null {
    const stmt = this.db.prepare(`
      SELECT 
        kd.*,
        kg.name as group_name,
        kg.weight as group_weight
      FROM kpi_definitions kd
      JOIN kpi_groups kg ON kd.group_id = kg.id
      WHERE kd.id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToKPIDefinitionWithGroup(row);
  }

  /**
   * Find KPI definition by name and group
   */
  findByNameAndGroup(name: string, groupId: number): KPIDefinition | null {
    const stmt = this.db.prepare(`
      SELECT * FROM kpi_definitions 
      WHERE name = ? AND group_id = ?
    `);

    const row = stmt.get(name, groupId) as any;
    if (!row) return null;

    return this.mapRowToKPIDefinition(row);
  }

  /**
   * Get all KPI definitions for a group
   */
  findByGroup(groupId: number): KPIDefinitionWithGroup[] {
    const stmt = this.db.prepare(`
      SELECT 
        kd.*,
        kg.name as group_name,
        kg.weight as group_weight
      FROM kpi_definitions kd
      JOIN kpi_groups kg ON kd.group_id = kg.id
      WHERE kd.group_id = ? AND kd.is_active = TRUE
      ORDER BY kd.name
    `);

    const rows = stmt.all(groupId) as any[];
    return rows.map(row => this.mapRowToKPIDefinitionWithGroup(row));
  }

  /**
   * Get all active KPI definitions with group information
   */
  findAllActive(): KPIDefinitionWithGroup[] {
    const stmt = this.db.prepare(`
      SELECT 
        kd.*,
        kg.name as group_name,
        kg.weight as group_weight
      FROM kpi_definitions kd
      JOIN kpi_groups kg ON kd.group_id = kg.id
      WHERE kd.is_active = TRUE
      ORDER BY kg.name, kd.name
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToKPIDefinitionWithGroup(row));
  }

  /**
   * Search KPI definitions by name or description
   */
  search(query: string): KPIDefinitionWithGroup[] {
    const searchTerm = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT 
        kd.*,
        kg.name as group_name,
        kg.weight as group_weight
      FROM kpi_definitions kd
      JOIN kpi_groups kg ON kd.group_id = kg.id
      WHERE kd.is_active = TRUE 
        AND (kd.name LIKE ? OR kd.description LIKE ?)
      ORDER BY kg.name, kd.name
    `);

    const rows = stmt.all(searchTerm, searchTerm) as any[];
    return rows.map(row => this.mapRowToKPIDefinitionWithGroup(row));
  }

  /**
   * Update KPI definition
   */
  update(kpiId: number, updates: Partial<Omit<CreateKPIDefinitionData, 'groupId'>>): KPIDefinitionWithGroup | null {
    const fields = [];
    const values = [];

    if (updates.name) {
      // Check name uniqueness within group
      const currentKPI = this.findById(kpiId);
      if (!currentKPI) return null;

      const existing = this.findByNameAndGroup(updates.name, currentKPI.groupId);
      if (existing && existing.id !== kpiId) {
        throw new Error('KPI definition name already exists in this group');
      }
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.targetValue !== undefined) {
      this.validateTargetValue(updates.targetValue);
      fields.push('target_value = ?');
      values.push(updates.targetValue);
    }

    if (updates.weight !== undefined) {
      this.validateWeight(updates.weight);
      const currentKPI = this.findById(kpiId);
      if (!currentKPI) return null;
      
      this.validateGroupWeightForUpdate(currentKPI.groupId, kpiId, updates.weight);
      fields.push('weight = ?');
      values.push(updates.weight);
    }

    if (updates.frequency) {
      this.validateFrequency(updates.frequency);
      fields.push('frequency = ?');
      values.push(updates.frequency);
    }

    if (fields.length === 0) {
      return this.findById(kpiId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(kpiId);

    const stmt = this.db.prepare(`
      UPDATE kpi_definitions 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    
    if (result.changes === 0) return null;

    return this.findById(kpiId);
  }

  /**
   * Deactivate KPI definition (soft delete)
   */
  deactivate(kpiId: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE kpi_definitions 
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(kpiId);
    return result.changes > 0;
  }

  /**
   * Reactivate KPI definition
   */
  reactivate(kpiId: number): KPIDefinitionWithGroup | null {
    const stmt = this.db.prepare(`
      UPDATE kpi_definitions 
      SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(kpiId);
    
    if (result.changes === 0) return null;

    return this.findById(kpiId);
  }

  /**
   * Validate KPI weights within a group total to 100
   */
  validateGroupWeights(groupId: number): KPIGroupWeightValidation {
    const stmt = this.db.prepare(`
      SELECT id, name, weight 
      FROM kpi_definitions 
      WHERE group_id = ? AND is_active = TRUE
      ORDER BY name
    `);

    const definitions = stmt.all(groupId) as any[];
    const totalWeight = definitions.reduce((sum, def) => sum + def.weight, 0);

    const errors = [];
    
    if (totalWeight !== 100) {
      errors.push(`Total KPI weights in group must equal 100, currently ${totalWeight}`);
    }

    // Check for zero weights
    const zeroWeightKPIs = definitions.filter(d => d.weight === 0);
    if (zeroWeightKPIs.length > 0) {
      errors.push(`KPIs with zero weight: ${zeroWeightKPIs.map(d => d.name).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      groupId,
      totalWeight,
      definitions: definitions.map(d => ({
        id: d.id,
        name: d.name,
        weight: d.weight
      }))
    };
  }

  /**
   * Rebalance KPI weights within a group proportionally to total 100
   */
  rebalanceGroupWeights(groupId: number): KPIGroupWeightValidation {
    const definitions = this.findByGroup(groupId);
    const currentTotal = definitions.reduce((sum, def) => sum + def.weight, 0);

    if (currentTotal === 0) {
      throw new Error('Cannot rebalance when all KPI weights are zero');
    }

    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE kpi_definitions 
        SET weight = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      
      for (const definition of definitions) {
        const newWeight = Math.round((definition.weight / currentTotal) * 100);
        stmt.run(newWeight, definition.id);
      }
    });

    transaction();

    return this.validateGroupWeights(groupId);
  }

  /**
   * Get KPI definition statistics
   */
  getStatistics(kpiId: number): KPIDefinitionStats | null {
    const stmt = this.db.prepare(`
      SELECT 
        kd.id as definition_id,
        kd.name as definition_name,
        COUNT(DISTINCT ki.id) as active_instances,
        COUNT(DISTINCT pr.id) as total_records,
        AVG(pr.score) as average_score,
        (COUNT(DISTINCT pr.id) * 100.0 / COUNT(DISTINCT ki.id)) as completion_rate,
        MAX(pr.created_at) as last_updated
      FROM kpi_definitions kd
      LEFT JOIN kpi_instances ki ON kd.id = ki.definition_id AND ki.is_active = TRUE
      LEFT JOIN performance_records pr ON ki.id = pr.instance_id
      WHERE kd.id = ?
      GROUP BY kd.id
    `);

    const row = stmt.get(kpiId) as any;
    if (!row) return null;

    return {
      definitionId: row.definition_id,
      definitionName: row.definition_name,
      activeInstances: row.active_instances || 0,
      totalRecords: row.total_records || 0,
      averageScore: row.average_score || 0,
      completionRate: row.completion_rate || 0,
      lastUpdated: row.last_updated ? new Date(row.last_updated) : null
    };
  }

  /**
   * Get KPI definitions by frequency
   */
  findByFrequency(frequency: string): KPIDefinitionWithGroup[] {
    const stmt = this.db.prepare(`
      SELECT 
        kd.*,
        kg.name as group_name,
        kg.weight as group_weight
      FROM kpi_definitions kd
      JOIN kpi_groups kg ON kd.group_id = kg.id
      WHERE kd.frequency = ? AND kd.is_active = TRUE
      ORDER BY kg.name, kd.name
    `);

    const rows = stmt.all(frequency) as any[];
    return rows.map(row => this.mapRowToKPIDefinitionWithGroup(row));
  }

  // Private helper methods

  private validateGroup(groupId: number): void {
    const stmt = this.db.prepare('SELECT id FROM kpi_groups WHERE id = ?');
    const group = stmt.get(groupId);

    if (!group) {
      throw new Error('KPI group not found');
    }
  }

  private validateWeight(weight: number): void {
    if (weight < 0 || weight > 100) {
      throw new Error('Weight must be between 0 and 100');
    }

    if (!Number.isInteger(weight)) {
      throw new Error('Weight must be an integer');
    }
  }

  private validateTargetValue(targetValue: number): void {
    if (targetValue < 0) {
      throw new Error('Target value must be non-negative');
    }
  }

  private validateFrequency(frequency: string): void {
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validFrequencies.includes(frequency)) {
      throw new Error(`Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`);
    }
  }

  private validateGroupWeightForNewKPI(groupId: number, newWeight: number): void {
    const stmt = this.db.prepare(`
      SELECT SUM(weight) as total 
      FROM kpi_definitions 
      WHERE group_id = ? AND is_active = TRUE
    `);
    
    const result = stmt.get(groupId) as any;
    const currentTotal = result.total || 0;

    if (currentTotal + newWeight > 100) {
      throw new Error(`Adding weight ${newWeight} would exceed group limit of 100 (current: ${currentTotal})`);
    }
  }

  private validateGroupWeightForUpdate(groupId: number, kpiId: number, newWeight: number): void {
    const stmt = this.db.prepare(`
      SELECT SUM(weight) as total 
      FROM kpi_definitions 
      WHERE group_id = ? AND id != ? AND is_active = TRUE
    `);
    
    const result = stmt.get(groupId, kpiId) as any;
    const otherKPIsTotal = result.total || 0;

    if (otherKPIsTotal + newWeight > 100) {
      throw new Error(`Updating weight to ${newWeight} would exceed group limit of 100 (other KPIs: ${otherKPIsTotal})`);
    }
  }

  private mapRowToKPIDefinition(row: any): KPIDefinition {
    return {
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      description: row.description,
      targetValue: row.target_value,
      weight: row.weight,
      frequency: row.frequency,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToKPIDefinitionWithGroup(row: any): KPIDefinitionWithGroup {
    return {
      ...this.mapRowToKPIDefinition(row),
      groupName: row.group_name,
      groupWeight: row.group_weight
    };
  }
}
