/**
 * KPI Management Service
 * Handles KPI groups, definitions, assignments, and instances
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { KPIGroupModel, KPIGroup } from '../models/KPIGroup';
import { KPIDefinitionModel, KPIDefinition } from '../models/KPIDefinition';
import { KPIInstanceModel, KPIInstance, KPIInstanceWithDetails } from '../models/KPIInstance';
import { TeamModel } from '../models/Team';
import { UserModel } from '../models/User';

export interface CreateKPIGroupData {
  name: string;
  description?: string;
  weight: number;
}

export interface UpdateKPIGroupData {
  name?: string;
  description?: string;
  weight?: number;
}

export interface CreateKPIDefinitionData {
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  targetValue: number;
  weight: number;
  groupId: number;
}

export interface UpdateKPIDefinitionData {
  name?: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  targetValue?: number;
  weight?: number;
  groupId?: number;
}

export interface AssignKPIData {
  definitionId: number;
  userId: number;
  startDate: Date;
  endDate: Date;
}

export interface KPIDashboardStats {
  totalGroups: number;
  totalDefinitions: number;
  totalInstances: number;
  activeInstances: number;
  inactiveInstances: number;
  recentInstances: KPIInstanceWithDetails[];
}

export class KPIManagementService {
  private kpiGroupModel: KPIGroupModel;
  private kpiDefinitionModel: KPIDefinitionModel;
  private kpiInstanceModel: KPIInstanceModel;
  private teamModel: TeamModel;
  private userModel: UserModel;

  constructor() {
    this.kpiGroupModel = new KPIGroupModel();
    this.kpiDefinitionModel = new KPIDefinitionModel();
    this.kpiInstanceModel = new KPIInstanceModel();
    this.teamModel = new TeamModel();
    this.userModel = new UserModel();
  }

  // KPI Group Management
  createKPIGroup(data: CreateKPIGroupData): KPIGroup {
    return this.kpiGroupModel.create(data);
  }

  updateKPIGroup(id: number, data: UpdateKPIGroupData): KPIGroup | null {
    return this.kpiGroupModel.update(id, data);
  }

  getKPIGroup(id: number): KPIGroup | null {
    return this.kpiGroupModel.findById(id);
  }

  getAllKPIGroups(): KPIGroup[] {
    return this.kpiGroupModel.findAll();
  }

  deleteKPIGroup(id: number): boolean {
    // Check if group has any definitions
    const definitions = this.kpiDefinitionModel.findByGroup(id);
    if (definitions.length > 0) {
      throw new Error('Cannot delete KPI group that contains definitions');
    }
    return this.kpiGroupModel.delete(id);
  }

  // KPI Definition Management
  createKPIDefinition(data: CreateKPIDefinitionData): KPIDefinition {
    // Validate group exists
    const group = this.kpiGroupModel.findById(data.groupId);
    if (!group) {
      throw new Error('KPI group not found');
    }
    
    return this.kpiDefinitionModel.create(data);
  }

  updateKPIDefinition(id: number, data: UpdateKPIDefinitionData): KPIDefinition | null {
    if (data.groupId) {
      const group = this.kpiGroupModel.findById(data.groupId);
      if (!group) {
        throw new Error('KPI group not found');
      }
    }
    
    return this.kpiDefinitionModel.update(id, data);
  }

  getKPIDefinition(id: number): KPIDefinition | null {
    return this.kpiDefinitionModel.findById(id);
  }

  getKPIDefinitionsByGroup(groupId: number): KPIDefinition[] {
    return this.kpiDefinitionModel.findByGroup(groupId);
  }

  getAllKPIDefinitions(): KPIDefinition[] {
    return this.kpiDefinitionModel.findAllActive();
  }

  deleteKPIDefinition(id: number): boolean {
    // Check if definition has any active instances
    const instances = this.kpiInstanceModel.findByDefinition(id);
    const activeInstances = instances.filter(inst => inst.isActive);
    
    if (activeInstances.length > 0) {
      throw new Error('Cannot delete KPI definition with active instances');
    }
    
    return this.kpiDefinitionModel.deactivate(id);
  }

  // KPI Instance Management
  assignKPI(data: AssignKPIData): KPIInstanceWithDetails {
    // Validate definition exists
    const definition = this.kpiDefinitionModel.findById(data.definitionId);
    if (!definition) {
      throw new Error('KPI definition not found');
    }

    // Validate assignee exists
    const assignee = this.userModel.findById(data.userId);
    if (!assignee) {
      throw new Error('Assignee not found');
    }

    return this.kpiInstanceModel.create({
      definitionId: data.definitionId,
      userId: data.userId,
      startDate: data.startDate,
      endDate: data.endDate
    });
  }

  updateKPIInstanceDates(id: number, startDate: Date, endDate: Date): KPIInstanceWithDetails | null {
    return this.kpiInstanceModel.updateDates(id, startDate, endDate);
  }

  getKPIInstance(id: number): KPIInstanceWithDetails | null {
    return this.kpiInstanceModel.findById(id);
  }

  getKPIInstancesByUser(userId: number, includeInactive: boolean = false): KPIInstanceWithDetails[] {
    return this.kpiInstanceModel.findByUser(userId, includeInactive);
  }

  getKPIInstancesByDefinition(definitionId: number): KPIInstanceWithDetails[] {
    return this.kpiInstanceModel.findByDefinition(definitionId);
  }

  getActiveKPIInstances(): KPIInstanceWithDetails[] {
    const now = new Date();
    return this.kpiInstanceModel.findActiveInDateRange(
      new Date(now.getFullYear(), 0, 1), // Start of year
      new Date(now.getFullYear() + 1, 0, 1) // Start of next year
    );
  }

  // Status Management
  deactivateKPIInstance(id: number): boolean {
    return this.kpiInstanceModel.deactivate(id);
  }

  reactivateKPIInstance(id: number): KPIInstanceWithDetails | null {
    return this.kpiInstanceModel.reactivate(id);
  }

  // Analytics and Reporting
  getKPIDashboardStats(): KPIDashboardStats {
    const groups = this.getAllKPIGroups();
    const definitions = this.getAllKPIDefinitions();
    
    // Get all active instances from current year
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
    const activeInstances = this.kpiInstanceModel.findActiveInDateRange(yearStart, yearEnd);
    
    // Get expiring instances as a proxy for "recent" activity
    const recentInstances = this.kpiInstanceModel.findExpiringSoon(30).slice(0, 5);

    return {
      totalGroups: groups.length,
      totalDefinitions: definitions.length,
      totalInstances: activeInstances.length, // Only active instances for now
      activeInstances: activeInstances.length,
      inactiveInstances: 0, // Would need a different query to get this accurately
      recentInstances
    };
  }

  getManagerKPIDashboard(managerId: number): {
    teamInstances: KPIInstanceWithDetails[];
    activeCount: number;
    inactiveCount: number;
  } {
    // Get teams managed by this manager
    const managedTeams = this.teamModel.findByManager(managerId);
    
    // Get all team members
    const teamMemberIds = new Set<number>();
    for (const team of managedTeams) {
      const members = this.teamModel.getMembers(team.id);
      members.forEach(member => teamMemberIds.add(member.userId));
    }

    // Get all instances for team members
    const teamInstances: KPIInstanceWithDetails[] = [];
    for (const userId of teamMemberIds) {
      const userInstances = this.getKPIInstancesByUser(userId, true);
      teamInstances.push(...userInstances);
    }

    const activeCount = teamInstances.filter(inst => inst.isActive).length;
    const inactiveCount = teamInstances.filter(inst => !inst.isActive).length;

    return {
      teamInstances,
      activeCount,
      inactiveCount
    };
  }

  getEmployeeKPIDashboard(employeeId: number): {
    myInstances: KPIInstanceWithDetails[];
    activeKPIs: KPIInstanceWithDetails[];
    inactiveKPIs: KPIInstanceWithDetails[];
  } {
    const myInstances = this.getKPIInstancesByUser(employeeId, true);
    const activeKPIs = myInstances.filter(inst => inst.isActive);
    const inactiveKPIs = myInstances.filter(inst => !inst.isActive);

    return {
      myInstances,
      activeKPIs,
      inactiveKPIs
    };
  }

  /**
   * Search KPI instances by various criteria
   */
  searchKPIInstances(query: string): KPIInstanceWithDetails[] {
    // Use the existing search functionality from the definition model
    const matchingDefinitions = this.kpiDefinitionModel.search(query);
    const instances: KPIInstanceWithDetails[] = [];
    
    for (const definition of matchingDefinitions) {
      instances.push(...this.kpiInstanceModel.findByDefinition(definition.id));
    }
    
    return instances;
  }

  /**
   * Get statistics for a specific KPI group
   */
  getKPIGroupStats(groupId: number): {
    group: KPIGroup | null;
    definitionCount: number;
    totalInstances: number;
    activeInstances: number;
    averageScore: number;
  } {
    const group = this.getKPIGroup(groupId);
    if (!group) {
      return {
        group: null,
        definitionCount: 0,
        totalInstances: 0,
        activeInstances: 0,
        averageScore: 0
      };
    }

    const definitions = this.getKPIDefinitionsByGroup(groupId);
    const instances = definitions.flatMap(def => this.getKPIInstancesByDefinition(def.id));
    const activeInstances = instances.filter(inst => inst.isActive);
    
    const averageScore = instances.length > 0 && instances.some(inst => inst.currentScore !== null)
      ? instances
          .filter(inst => inst.currentScore !== null)
          .reduce((sum, inst) => sum + (inst.currentScore || 0), 0) / 
        instances.filter(inst => inst.currentScore !== null).length
      : 0;

    return {
      group,
      definitionCount: definitions.length,
      totalInstances: instances.length,
      activeInstances: activeInstances.length,
      averageScore: Math.round(averageScore * 100) / 100
    };
  }

  /**
   * Get statistics for a specific KPI definition
   */
  getKPIDefinitionStats(definitionId: number): {
    definition: KPIDefinition | null;
    instanceCount: number;
    activeInstances: number;
    averageScore: number;
    group: KPIGroup | null;
  } {
    const definition = this.getKPIDefinition(definitionId);
    if (!definition) {
      return {
        definition: null,
        instanceCount: 0,
        activeInstances: 0,
        averageScore: 0,
        group: null
      };
    }

    const group = this.getKPIGroup(definition.groupId);
    const instances = this.getKPIInstancesByDefinition(definitionId);
    const activeInstances = instances.filter(inst => inst.isActive);
    
    const averageScore = instances.length > 0 && instances.some(inst => inst.currentScore !== null)
      ? instances
          .filter(inst => inst.currentScore !== null)
          .reduce((sum, inst) => sum + (inst.currentScore || 0), 0) / 
        instances.filter(inst => inst.currentScore !== null).length
      : 0;

    return {
      definition,
      instanceCount: instances.length,
      activeInstances: activeInstances.length,
      averageScore: Math.round(averageScore * 100) / 100,
      group
    };
  }
}
