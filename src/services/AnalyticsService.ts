/**
 * Analytics Service
 * Handles performance calculations, trends, and reporting
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { PerformanceRecordModel, PerformanceRecord, PerformanceRecordWithDetails } from '../models/PerformanceRecord';
import { KPIInstanceModel, KPIInstanceWithDetails } from '../models/KPIInstance';
import { KPIDefinitionModel } from '../models/KPIDefinition';
import { UserModel } from '../models/User';
import { TeamModel } from '../models/Team';

export interface PerformanceAnalytics {
  totalRecords: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  scoreDistribution: {
    excellent: number; // 90-100
    good: number;      // 70-89
    average: number;   // 50-69
    poor: number;      // 0-49
  };
  trendDirection: 'improving' | 'declining' | 'stable';
  recentTrend: number; // Percentage change from previous period
}

export interface UserPerformanceAnalytics extends PerformanceAnalytics {
  userId: number;
  userName: string;
  activeKPIs: number;
  completedKPIs: number;
  topPerformingKPIs: PerformanceRecordWithDetails[];
  improvementAreas: PerformanceRecordWithDetails[];
}

export interface TeamPerformanceAnalytics extends PerformanceAnalytics {
  teamId: number;
  teamName: string;
  memberCount: number;
  topPerformers: UserPerformanceAnalytics[];
  underPerformers: UserPerformanceAnalytics[];
}

export interface KPIPerformanceAnalytics extends PerformanceAnalytics {
  kpiInstanceId: number;
  definitionName: string;
  targetValue: number;
  currentValue: number | null;
  progressToTarget: number; // Percentage
  daysToDeadline: number | null;
  onTrack: boolean;
}

export interface PeriodComparison {
  current: PerformanceAnalytics;
  previous: PerformanceAnalytics;
  improvement: number; // Percentage change
  significantChange: boolean;
}

export interface TrendAnalysis {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dataPoints: {
    date: Date;
    value: number;
    count: number;
  }[];
  trendLine: {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    confidence: number; // 0-1
  };
}

export class AnalyticsService {
  private performanceModel: PerformanceRecordModel;
  private kpiInstanceModel: KPIInstanceModel;
  private kpiDefinitionModel: KPIDefinitionModel;
  private userModel: UserModel;
  private teamModel: TeamModel;

  constructor() {
    this.performanceModel = new PerformanceRecordModel();
    this.kpiInstanceModel = new KPIInstanceModel();
    this.kpiDefinitionModel = new KPIDefinitionModel();
    this.userModel = new UserModel();
    this.teamModel = new TeamModel();
  }

  /**
   * Get performance analytics for a user
   */
  getUserPerformanceAnalytics(userId: number, dateRange?: { start: Date; end: Date }): UserPerformanceAnalytics | null {
    const user = this.userModel.findById(userId);
    if (!user) return null;

    const records = dateRange 
      ? this.performanceModel.findByUserAndDateRange(userId, dateRange.start, dateRange.end)
      : this.performanceModel.findByUserAndDateRange(userId, new Date(2020, 0, 1), new Date());

    const baseAnalytics = this.calculateBaseAnalytics(records);
    const userInstances = this.kpiInstanceModel.findByUser(userId, true);
    
    const activeKPIs = userInstances.filter(inst => inst.isActive).length;
    const completedKPIs = userInstances.filter(inst => !inst.isActive).length;

    // Get top performing KPIs (highest scores)
    const topPerformingKPIs = records
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Get improvement areas (lowest scores or declining trends)
    const improvementAreas = records
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    return {
      ...baseAnalytics,
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      activeKPIs,
      completedKPIs,
      topPerformingKPIs,
      improvementAreas
    };
  }

  /**
   * Get performance analytics for a team
   */
  getTeamPerformanceAnalytics(teamId: number, dateRange?: { start: Date; end: Date }): TeamPerformanceAnalytics | null {
    const team = this.teamModel.findById(teamId);
    if (!team) return null;

    const members = this.teamModel.getMembers(teamId);
    const memberIds = members.map(m => m.userId);

    // Get all records for team members
    const allRecords: PerformanceRecordWithDetails[] = [];
    for (const memberId of memberIds) {
      const memberRecords = dateRange
        ? this.performanceModel.findByUserAndDateRange(memberId, dateRange.start, dateRange.end)
        : this.performanceModel.findByUserAndDateRange(memberId, new Date(2020, 0, 1), new Date());
      allRecords.push(...memberRecords);
    }

    const baseAnalytics = this.calculateBaseAnalytics(allRecords);

    // Get individual member analytics
    const memberAnalytics = memberIds
      .map(memberId => this.getUserPerformanceAnalytics(memberId, dateRange))
      .filter((analytics): analytics is UserPerformanceAnalytics => analytics !== null)
      .sort((a, b) => b.averageScore - a.averageScore);

    const topPerformers = memberAnalytics.slice(0, 3);
    const underPerformers = memberAnalytics
      .filter(m => m.averageScore < 70) // Below 70% threshold
      .slice(0, 3);

    return {
      ...baseAnalytics,
      teamId,
      teamName: team.name,
      memberCount: members.length,
      topPerformers,
      underPerformers
    };
  }

  /**
   * Get performance analytics for a specific KPI instance
   */
  getKPIPerformanceAnalytics(instanceId: number, dateRange?: { start: Date; end: Date }): KPIPerformanceAnalytics | null {
    const instance = this.kpiInstanceModel.findById(instanceId);
    if (!instance) return null;

    const definition = this.kpiDefinitionModel.findById(instance.definitionId);
    if (!definition) return null;

    const records = this.performanceModel.findByInstance(instanceId);

    const baseAnalytics = this.calculateBaseAnalytics(records);
    
    const currentValue = instance.currentScore;
    const targetValue = definition.targetValue;
    const progressToTarget = currentValue !== null ? (currentValue / targetValue) * 100 : 0;

    const daysToDeadline = Math.ceil((instance.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const onTrack = progressToTarget >= 70; // Simple threshold

    return {
      ...baseAnalytics,
      kpiInstanceId: instanceId,
      definitionName: definition.name,
      targetValue,
      currentValue,
      progressToTarget: Math.min(100, Math.max(0, progressToTarget)),
      daysToDeadline: daysToDeadline > 0 ? daysToDeadline : null,
      onTrack
    };
  }

  /**
   * Compare performance between two periods
   */
  comparePeriods(
    userId: number,
    currentPeriod: { start: Date; end: Date },
    previousPeriod: { start: Date; end: Date }
  ): PeriodComparison {
    const currentRecords = this.performanceModel.findByUserAndDateRange(
      userId, 
      currentPeriod.start, 
      currentPeriod.end
    );
    const previousRecords = this.performanceModel.findByUserAndDateRange(
      userId, 
      previousPeriod.start, 
      previousPeriod.end
    );

    const current = this.calculateBaseAnalytics(currentRecords);
    const previous = this.calculateBaseAnalytics(previousRecords);

    const improvement = previous.averageScore > 0 
      ? ((current.averageScore - previous.averageScore) / previous.averageScore) * 100
      : 0;

    const significantChange = Math.abs(improvement) >= 10; // 10% threshold

    return {
      current,
      previous,
      improvement,
      significantChange
    };
  }

  /**
   * Generate trend analysis for a user over time
   */
  getTrendAnalysis(
    userId: number,
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly',
    dateRange: { start: Date; end: Date }
  ): TrendAnalysis {
    const records = this.performanceModel.findByUserAndDateRange(userId, dateRange.start, dateRange.end);
    
    // Group records by period
    const dataPoints = this.groupRecordsByPeriod(records, period);
    
    // Calculate trend line
    const trendLine = this.calculateTrendLine(dataPoints);

    return {
      period,
      dataPoints,
      trendLine
    };
  }

  /**
   * Get organization-wide analytics
   */
  getOrganizationAnalytics(dateRange?: { start: Date; end: Date }): {
    totalUsers: number;
    totalTeams: number;
    totalKPIs: number;
    overallPerformance: PerformanceAnalytics;
    topPerformingTeams: TeamPerformanceAnalytics[];
    topPerformingUsers: UserPerformanceAnalytics[];
  } {
    // Get all users and teams
    const allUsers = this.userModel.findByRole('employee')
      .concat(this.userModel.findByRole('manager'))
      .concat(this.userModel.findByRole('both'));
    
    // Simplified approach - get teams from managed teams by all managers
    const allManagers = this.userModel.findByRole('manager')
      .concat(this.userModel.findByRole('both'));
    
    const allTeamIds = new Set<number>();
    for (const manager of allManagers) {
      const managedTeams = this.teamModel.findByManager(manager.id);
      managedTeams.forEach(team => allTeamIds.add(team.id));
    }

    // Get all performance records (recent records as proxy)
    const allRecords = this.performanceModel.findRecent(1000); // Get more records

    const overallPerformance = this.calculateBaseAnalytics(allRecords);

    // Get top performing teams (simplified)
    const topPerformingTeams: TeamPerformanceAnalytics[] = [];
    for (const teamId of Array.from(allTeamIds).slice(0, 5)) {
      const teamAnalytics = this.getTeamPerformanceAnalytics(teamId, dateRange);
      if (teamAnalytics) {
        topPerformingTeams.push(teamAnalytics);
      }
    }
    topPerformingTeams.sort((a, b) => b.averageScore - a.averageScore);

    // Get top performing users
    const topPerformingUsers = allUsers
      .map(user => this.getUserPerformanceAnalytics(user.id, dateRange))
      .filter((analytics): analytics is UserPerformanceAnalytics => analytics !== null)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    // Get active KPI instances count
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const activeKPIs = this.kpiInstanceModel.findActiveInDateRange(yearStart, now);

    return {
      totalUsers: allUsers.length,
      totalTeams: allTeamIds.size,
      totalKPIs: activeKPIs.length,
      overallPerformance,
      topPerformingTeams,
      topPerformingUsers
    };
  }

  /**
   * Get performance insights and recommendations
   */
  getPerformanceInsights(userId: number): {
    insights: string[];
    recommendations: string[];
    alerts: string[];
  } {
    const userAnalytics = this.getUserPerformanceAnalytics(userId);
    if (!userAnalytics) {
      return { insights: [], recommendations: [], alerts: [] };
    }

    const insights: string[] = [];
    const recommendations: string[] = [];
    const alerts: string[] = [];

    // Generate insights based on performance
    if (userAnalytics.averageScore >= 90) {
      insights.push('Excellent performance! You\'re consistently exceeding expectations.');
    } else if (userAnalytics.averageScore >= 70) {
      insights.push('Good performance with room for improvement in some areas.');
    } else {
      insights.push('Performance needs attention. Several KPIs are below target.');
    }

    // Trend analysis
    if (userAnalytics.trendDirection === 'improving') {
      insights.push('Your performance trend is positive - keep up the good work!');
    } else if (userAnalytics.trendDirection === 'declining') {
      alerts.push('Your performance trend is declining. Consider reviewing your strategies.');
    }

    // Recommendations based on distribution
    if (userAnalytics.scoreDistribution.poor > 0) {
      recommendations.push('Focus on improving your lowest-performing KPIs first.');
    }
    
    if (userAnalytics.scoreDistribution.excellent < userAnalytics.scoreDistribution.average) {
      recommendations.push('Try to elevate your average performers to excellent level.');
    }

    // Active KPI alerts
    if (userAnalytics.activeKPIs > 10) {
      alerts.push('You have many active KPIs. Consider prioritizing the most important ones.');
    }

    return { insights, recommendations, alerts };
  }

  // Helper methods
  private calculateBaseAnalytics(records: PerformanceRecord[]): PerformanceAnalytics {
    if (records.length === 0) {
      return {
        totalRecords: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        scoreDistribution: { excellent: 0, good: 0, average: 0, poor: 0 },
        trendDirection: 'stable',
        recentTrend: 0
      };
    }

    const scores = records.map(r => r.score);
    const totalRecords = records.length;
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / totalRecords;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    // Calculate score distribution
    const scoreDistribution = {
      excellent: scores.filter(s => s >= 90).length,
      good: scores.filter(s => s >= 70 && s < 90).length,
      average: scores.filter(s => s >= 50 && s < 70).length,
      poor: scores.filter(s => s < 50).length
    };

    // Simple trend calculation (compare first half vs second half)
    const midPoint = Math.floor(records.length / 2);
    const firstHalfAvg = records.slice(0, midPoint).reduce((sum, r) => sum + r.score, 0) / midPoint || 0;
    const secondHalfAvg = records.slice(midPoint).reduce((sum, r) => sum + r.score, 0) / (records.length - midPoint) || 0;
    
    const recentTrend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
    
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (Math.abs(recentTrend) >= 5) { // 5% threshold
      trendDirection = recentTrend > 0 ? 'improving' : 'declining';
    }

    return {
      totalRecords,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore,
      lowestScore,
      scoreDistribution,
      trendDirection,
      recentTrend: Math.round(recentTrend * 100) / 100
    };
  }

  private groupRecordsByPeriod(
    records: PerformanceRecord[],
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  ): { date: Date; value: number; count: number }[] {
    const groups = new Map<string, { scores: number[]; date: Date }>();

    records.forEach(record => {
      let key: string;
      let groupDate: Date;
      
      const recordDate = record.createdAt;
      
      switch (period) {
        case 'daily':
          key = recordDate.toISOString().split('T')[0];
          groupDate = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
          break;
        case 'weekly':
          const weekStart = new Date(recordDate);
          weekStart.setDate(recordDate.getDate() - recordDate.getDay());
          key = weekStart.toISOString().split('T')[0];
          groupDate = weekStart;
          break;
        case 'monthly':
          key = `${recordDate.getFullYear()}-${recordDate.getMonth()}`;
          groupDate = new Date(recordDate.getFullYear(), recordDate.getMonth(), 1);
          break;
        case 'quarterly':
          const quarter = Math.floor(recordDate.getMonth() / 3);
          key = `${recordDate.getFullYear()}-Q${quarter}`;
          groupDate = new Date(recordDate.getFullYear(), quarter * 3, 1);
          break;
      }

      if (!groups.has(key)) {
        groups.set(key, { scores: [], date: groupDate });
      }
      groups.get(key)!.scores.push(record.score);
    });

    return Array.from(groups.values()).map(group => ({
      date: group.date,
      value: group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length,
      count: group.scores.length
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateTrendLine(dataPoints: { date: Date; value: number; count: number }[]): {
    slope: number;
    direction: 'improving' | 'declining' | 'stable';
    confidence: number;
  } {
    if (dataPoints.length < 2) {
      return { slope: 0, direction: 'stable', confidence: 0 };
    }

    // Simple linear regression
    const n = dataPoints.length;
    const xValues = dataPoints.map((_, i) => i);
    const yValues = dataPoints.map(p => p.value);
    
    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const predictedY = xValues.map(x => (sumY / n) + slope * (x - sumX / n));
    const residualSumSquares = yValues.reduce((sum, y, i) => sum + Math.pow(y - predictedY[i], 2), 0);
    const confidence = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;
    
    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (Math.abs(slope) >= 0.1) { // Threshold for significant change
      direction = slope > 0 ? 'improving' : 'declining';
    }

    return {
      slope: Math.round(slope * 1000) / 1000,
      direction,
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }
}
