/**
 * BaseRepository
 * Provides common repository functionality and database utilities
 * Based on: specs/001-kpi-tracker-with/data-model.md
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../shared/database';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterOptions {
  [key: string]: any;
}

export interface SearchOptions {
  query: string;
  fields: string[];
}

export abstract class BaseRepository {
  protected db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Execute a paginated query
   */
  protected paginate<T>(
    baseQuery: string,
    countQuery: string,
    params: any[],
    options: PaginationOptions,
    mapper: (row: any) => T
  ): PaginatedResult<T> {
    // Get total count
    const countStmt = this.db.prepare(countQuery);
    const countResult = countStmt.get(...params) as any;
    const total = countResult.count || 0;

    // Calculate pagination
    const totalPages = Math.ceil(total / options.limit);
    const offset = (options.page - 1) * options.limit;

    // Build paginated query
    let paginatedQuery = baseQuery;
    
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'ASC';
      paginatedQuery += ` ORDER BY ${options.sortBy} ${sortOrder}`;
    }
    
    paginatedQuery += ` LIMIT ? OFFSET ?`;

    // Execute paginated query
    const stmt = this.db.prepare(paginatedQuery);
    const rows = stmt.all(...params, options.limit, offset) as any[];

    return {
      data: rows.map(mapper),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasNext: options.page < totalPages,
        hasPrev: options.page > 1
      }
    };
  }

  /**
   * Build WHERE clause from filter options
   */
  protected buildWhereClause(filters: FilterOptions, aliasPrefix: string = ''): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;

      const column = aliasPrefix ? `${aliasPrefix}.${key}` : key;

      if (Array.isArray(value)) {
        if (value.length > 0) {
          const placeholders = value.map(() => '?').join(',');
          conditions.push(`${column} IN (${placeholders})`);
          params.push(...value);
        }
      } else if (typeof value === 'object' && value.operator) {
        // Support for custom operators like { operator: '>=', value: 10 }
        conditions.push(`${column} ${value.operator} ?`);
        params.push(value.value);
      } else if (typeof value === 'string' && value.includes('%')) {
        // LIKE operator for pattern matching
        conditions.push(`${column} LIKE ?`);
        params.push(value);
      } else {
        conditions.push(`${column} = ?`);
        params.push(value);
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Build search clause for text fields
   */
  protected buildSearchClause(search: SearchOptions, aliasPrefix: string = ''): { clause: string; params: any[] } {
    if (!search.query || search.fields.length === 0) {
      return { clause: '', params: [] };
    }

    const searchTerm = `%${search.query}%`;
    const conditions = search.fields.map(field => {
      const column = aliasPrefix ? `${aliasPrefix}.${field}` : field;
      return `${column} LIKE ?`;
    });

    return {
      clause: `WHERE (${conditions.join(' OR ')})`,
      params: Array(search.fields.length).fill(searchTerm)
    };
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  protected executeTransaction<T>(callback: () => T): T {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  /**
   * Check if a record exists by ID
   */
  protected exists(tableName: string, id: number): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ?`);
    return stmt.get(id) !== undefined;
  }

  /**
   * Get the next available ID for a table (useful for testing)
   */
  protected getNextId(tableName: string): number {
    const stmt = this.db.prepare(`SELECT MAX(id) as max_id FROM ${tableName}`);
    const result = stmt.get() as any;
    return (result.max_id || 0) + 1;
  }

  /**
   * Soft delete a record
   */
  protected softDelete(tableName: string, id: number, deletedColumn: string = 'is_deleted'): boolean {
    const stmt = this.db.prepare(`
      UPDATE ${tableName} 
      SET ${deletedColumn} = TRUE, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Restore a soft-deleted record
   */
  protected restore(tableName: string, id: number, deletedColumn: string = 'is_deleted'): boolean {
    const stmt = this.db.prepare(`
      UPDATE ${tableName} 
      SET ${deletedColumn} = FALSE, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Batch insert records
   */
  protected batchInsert<T>(
    tableName: string,
    records: T[],
    columns: string[],
    valueExtractor: (record: T) => any[]
  ): number {
    if (records.length === 0) return 0;

    const placeholders = columns.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      INSERT INTO ${tableName} (${columns.join(',')})
      VALUES (${placeholders})
    `);

    const transaction = this.db.transaction(() => {
      let insertedCount = 0;
      for (const record of records) {
        const values = valueExtractor(record);
        stmt.run(...values);
        insertedCount++;
      }
      return insertedCount;
    });

    return transaction();
  }

  /**
   * Batch update records
   */
  protected batchUpdate<T>(
    tableName: string,
    records: T[],
    updateColumns: string[],
    valueExtractor: (record: T) => { values: any[]; id: number }
  ): number {
    if (records.length === 0) return 0;

    const setClause = updateColumns.map(col => `${col} = ?`).join(',');
    const stmt = this.db.prepare(`
      UPDATE ${tableName} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const transaction = this.db.transaction(() => {
      let updatedCount = 0;
      for (const record of records) {
        const { values, id } = valueExtractor(record);
        const result = stmt.run(...values, id);
        if (result.changes > 0) updatedCount++;
      }
      return updatedCount;
    });

    return transaction();
  }

  /**
   * Get database statistics for a table
   */
  protected getTableStats(tableName: string): {
    totalRecords: number;
    activeRecords?: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
  } {
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
    const totalResult = totalStmt.get() as any;

    const activeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE is_active = TRUE`);
    let activeResult;
    try {
      activeResult = activeStmt.get() as any;
    } catch {
      // Table might not have is_active column
      activeResult = null;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const todayStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE created_at >= ?`);
    const weekStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE created_at >= ?`);
    const monthStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE created_at >= ?`);

    const todayResult = todayStmt.get(today) as any;
    const weekResult = weekStmt.get(weekAgo) as any;
    const monthResult = monthStmt.get(monthAgo) as any;

    const stats: any = {
      totalRecords: totalResult.count,
      createdToday: todayResult.count,
      createdThisWeek: weekResult.count,
      createdThisMonth: monthResult.count
    };

    if (activeResult) {
      stats.activeRecords = activeResult.count;
    }

    return stats;
  }

  /**
   * Validate required fields are present
   */
  protected validateRequired(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => {
      const value = data[field];
      return value === null || value === undefined || value === '';
    });

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Sanitize string input (basic SQL injection prevention)
   */
  protected sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/'/g, "''")  // Escape single quotes
      .replace(/[^\w\s\-_.@]/g, '') // Remove special chars except common ones
      .trim();
  }

  /**
   * Format date for database storage
   */
  protected formatDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * Parse date from database
   */
  protected parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Log query performance (development utility)
   */
  protected logQuery(query: string, params: any[], startTime: number): void {
    if (process.env.NODE_ENV === 'development') {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (duration > 100) { // Log slow queries (>100ms)
        console.warn(`Slow query detected (${duration}ms):`, {
          query: query.substring(0, 100) + '...',
          params: params.length,
          duration
        });
      }
    }
  }

  /**
   * Create audit trail entry (if audit table exists)
   */
  protected createAuditEntry(
    tableName: string,
    recordId: number,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    userId?: number,
    changes?: any
  ): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_log (table_name, record_id, action, user_id, changes, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        tableName,
        recordId,
        action,
        userId || null,
        changes ? JSON.stringify(changes) : null
      );
    } catch (error) {
      // Audit table might not exist, fail silently
      console.warn('Audit logging failed:', error);
    }
  }
}
