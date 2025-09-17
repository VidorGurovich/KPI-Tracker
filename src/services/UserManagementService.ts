/**
 * User Management Service
 * Handles user profiles, team memberships, and role management
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { UserModel, UserSafeData, UserRole } from '../models/User';
import { TeamModel, TeamWithDetails } from '../models/Team';

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
}

export interface UserProfileData extends UserSafeData {
  managedTeams?: TeamWithDetails[];
  memberOfTeams?: TeamWithDetails[];
  teamCount: number;
  memberCount: number;
}

export interface UserSearchFilters {
  role?: UserRole;
  emailVerified?: boolean;
  query?: string;
}

export interface PaginatedUsers {
  users: UserSafeData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserManagementService {
  private userModel: UserModel;
  private teamModel: TeamModel;

  constructor() {
    this.userModel = new UserModel();
    this.teamModel = new TeamModel();
  }

  /**
   * Get user profile with team information
   */
  getUserProfile(userId: number): UserProfileData | null {
    const user = this.userModel.findById(userId);
    if (!user) return null;

    const safeUser = this.userModel.toSafeData(user);
    
    // Get managed teams (if user is a manager)
    let managedTeams: TeamWithDetails[] = [];
    let memberOfTeams: TeamWithDetails[] = [];
    
    if (this.userModel.isManager(user)) {
      managedTeams = this.teamModel.findByManager(userId);
    }
    
    if (this.userModel.isEmployee(user)) {
      memberOfTeams = this.teamModel.findByMember(userId);
    }

    return {
      ...safeUser,
      managedTeams,
      memberOfTeams,
      teamCount: managedTeams.length,
      memberCount: memberOfTeams.length
    };
  }

  /**
   * Update user profile
   */
  updateProfile(userId: number, updates: UpdateProfileData): UserSafeData | null {
    return this.userModel.updateProfile(userId, updates);
  }

  /**
   * Get all users with optional filters
   */
  getUsers(filters?: UserSearchFilters): UserSafeData[] {
    if (filters?.role) {
      const roleUsers = this.userModel.findByRole(filters.role);
      
      if (filters.query) {
        const searchTerm = filters.query.toLowerCase();
        return roleUsers.filter(user => 
          user.email.toLowerCase().includes(searchTerm) ||
          user.firstName.toLowerCase().includes(searchTerm) ||
          user.lastName.toLowerCase().includes(searchTerm)
        );
      }
      
      return roleUsers;
    }

    if (filters?.query) {
      return this.userModel.search(filters.query);
    }

    // Return all users (this should be paginated in a real app)
    return this.userModel.findByRole('employee')
      .concat(this.userModel.findByRole('manager'))
      .concat(this.userModel.findByRole('both'));
  }

  /**
   * Get users with pagination
   */
  getUsersPaginated(page: number = 1, limit: number = 20, filters?: UserSearchFilters): PaginatedUsers {
    const allUsers = this.getUsers(filters);
    const total = allUsers.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const users = allUsers.slice(offset, offset + limit);

    return {
      users,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): UserSafeData | null {
    const user = this.userModel.findByEmail(email);
    return user ? this.userModel.toSafeData(user) : null;
  }

  /**
   * Get user by ID
   */
  getUserById(id: number): UserSafeData | null {
    const user = this.userModel.findById(id);
    return user ? this.userModel.toSafeData(user) : null;
  }

  /**
   * Get all managers
   */
  getManagers(): UserSafeData[] {
    const managers = this.userModel.findByRole('manager');
    const both = this.userModel.findByRole('both');
    return [...managers, ...both];
  }

  /**
   * Get all employees
   */
  getEmployees(): UserSafeData[] {
    const employees = this.userModel.findByRole('employee');
    const both = this.userModel.findByRole('both');
    return [...employees, ...both];
  }

  /**
   * Get employees who are not in any team
   */
  getUnassignedEmployees(): UserSafeData[] {
    const allEmployees = this.getEmployees();
    
    return allEmployees.filter(employee => {
      const memberOfTeams = this.teamModel.findByMember(employee.id);
      return memberOfTeams.length === 0;
    });
  }

  /**
   * Check if user can manage another user
   */
  canManageUser(managerId: number, targetUserId: number): boolean {
    const manager = this.userModel.findById(managerId);
    if (!manager || !this.userModel.isManager(manager)) {
      return false;
    }

    // Manager can manage users in their teams
    const managedTeams = this.teamModel.findByManager(managerId);
    
    for (const team of managedTeams) {
      if (this.teamModel.isMember(team.id, targetUserId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get team members for a manager
   */
  getTeamMembers(managerId: number): UserSafeData[] {
    const managedTeams = this.teamModel.findByManager(managerId);
    const memberIds = new Set<number>();
    
    for (const team of managedTeams) {
      const members = this.teamModel.getMembers(team.id);
      members.forEach(member => memberIds.add(member.userId));
    }

    return Array.from(memberIds)
      .map(id => this.getUserById(id))
      .filter((user): user is UserSafeData => user !== null);
  }

  /**
   * Get user statistics
   */
  getUserStats(): {
    totalUsers: number;
    totalManagers: number;
    totalEmployees: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    usersInTeams: number;
    unassignedUsers: number;
  } {
    const managers = this.getManagers();
    const employees = this.getEmployees();
    const allUsers = this.getUsers();
    
    const verifiedUsers = allUsers.filter(user => user.emailVerified);
    const unverifiedUsers = allUsers.filter(user => !user.emailVerified);
    
    const usersInTeams = allUsers.filter(user => {
      const memberOfTeams = this.teamModel.findByMember(user.id);
      return memberOfTeams.length > 0;
    });
    
    const unassignedUsers = allUsers.filter(user => {
      const memberOfTeams = this.teamModel.findByMember(user.id);
      return memberOfTeams.length === 0;
    });

    return {
      totalUsers: allUsers.length,
      totalManagers: managers.length,
      totalEmployees: employees.length,
      verifiedUsers: verifiedUsers.length,
      unverifiedUsers: unverifiedUsers.length,
      usersInTeams: usersInTeams.length,
      unassignedUsers: unassignedUsers.length
    };
  }

  /**
   * Get manager's dashboard data
   */
  getManagerDashboard(managerId: number): {
    profile: UserProfileData | null;
    managedTeams: TeamWithDetails[];
    totalTeamMembers: number;
    teamStats: {
      teamId: number;
      teamName: string;
      memberCount: number;
      activeKPIs: number;
      averagePerformance: number;
    }[];
  } | null {
    const profile = this.getUserProfile(managerId);
    if (!profile || !profile.managedTeams) {
      return null;
    }

    const managedTeams = profile.managedTeams;
    const totalTeamMembers = managedTeams.reduce((sum, team) => sum + team.memberCount, 0);
    
    const teamStats = managedTeams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      memberCount: team.memberCount,
      activeKPIs: 0, // This would be calculated from KPI instances
      averagePerformance: 0 // This would be calculated from performance records
    }));

    return {
      profile,
      managedTeams,
      totalTeamMembers,
      teamStats
    };
  }

  /**
   * Get employee's dashboard data
   */
  getEmployeeDashboard(employeeId: number): {
    profile: UserProfileData | null;
    teams: TeamWithDetails[];
    managers: UserSafeData[];
    kpiStats: {
      activeKPIs: number;
      completedKPIs: number;
      averageScore: number;
      recentActivity: number;
    };
  } | null {
    const profile = this.getUserProfile(employeeId);
    if (!profile) return null;

    const teams = profile.memberOfTeams || [];
    const managerIds = new Set(teams.map(team => team.managerId));
    const managers = Array.from(managerIds)
      .map(id => this.getUserById(id))
      .filter((user): user is UserSafeData => user !== null);

    // KPI stats would be calculated from KPI instances and performance records
    const kpiStats = {
      activeKPIs: 0,
      completedKPIs: 0,
      averageScore: 0,
      recentActivity: 0
    };

    return {
      profile,
      teams,
      managers,
      kpiStats
    };
  }

  /**
   * Validate user has required role
   */
  validateRole(userId: number, requiredRole: UserRole | UserRole[]): boolean {
    const user = this.userModel.findById(userId);
    if (!user) return false;

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // 'both' role has access to both manager and employee functions
    if (user.role === 'both') {
      return roles.includes('manager') || roles.includes('employee');
    }
    
    return roles.includes(user.role);
  }

  /**
   * Check if user is a manager
   */
  isManager(userId: number): boolean {
    return this.validateRole(userId, ['manager', 'both']);
  }

  /**
   * Check if user is an employee
   */
  isEmployee(userId: number): boolean {
    return this.validateRole(userId, ['employee', 'both']);
  }

  /**
   * Generate new verification token for user
   */
  generateNewVerificationToken(userId: number): string {
    return this.userModel.generateNewVerificationToken(userId);
  }

  /**
   * Search users by various criteria
   */
  searchUsers(query: string, limit: number = 20): UserSafeData[] {
    const results = this.userModel.search(query);
    return results.slice(0, limit);
  }
}
