import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface DatabaseConfig {
  filename: string;
  options?: Database.Options;
}

export interface Migration {
  version: string;
  description: string;
  sql: string;
}

export class DatabaseManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(config: DatabaseConfig) {
    // Ensure database directory exists
    const dbDir = path.dirname(config.filename);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.filename, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      ...config.options,
    });

    this.migrationsPath = path.join(process.cwd(), 'database', 'migrations');
    
    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    
    this.initializeMigrationTable();
  }

  private initializeMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async runMigrations(): Promise<void> {
    const migrations = this.getMigrations();
    const appliedMigrations = this.getAppliedMigrations();
    
    for (const migration of migrations) {
      if (!appliedMigrations.includes(migration.version)) {
        console.log(`Applying migration ${migration.version}: ${migration.description}`);
        
        const transaction = this.db.transaction(() => {
          this.db.exec(migration.sql);
          this.db.prepare(`
            INSERT INTO migrations (version, description) 
            VALUES (?, ?)
          `).run(migration.version, migration.description);
        });
        
        transaction();
        console.log(`✅ Migration ${migration.version} applied successfully`);
      }
    }
  }

  private getMigrations(): Migration[] {
    const migrationFiles = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return migrationFiles.map(file => {
      const filePath = path.join(this.migrationsPath, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const version = file.replace('.sql', '');
      
      // Extract description from first comment line
      const lines = sql.split('\n');
      const descriptionLine = lines.find(line => line.includes('Migration:'));
      const description = descriptionLine 
        ? descriptionLine.replace(/^--\s*Migration:\s*/, '').trim()
        : `Migration ${version}`;

      return { version, description, sql };
    });
  }

  private getAppliedMigrations(): string[] {
    const stmt = this.db.prepare('SELECT version FROM migrations ORDER BY version');
    return stmt.all().map((row: any) => row.version);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  // Transaction helper
  transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  // Health check
  healthCheck(): boolean {
    try {
      const result = this.db.prepare('SELECT 1 as test').get() as { test: number } | undefined;
      return result?.test === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Singleton instance for application use
let dbManager: DatabaseManager | null = null;

export function initializeDatabase(config?: DatabaseConfig): DatabaseManager {
  if (!dbManager) {
    const defaultConfig: DatabaseConfig = {
      filename: path.join(process.cwd(), 'database', 'kpi-tracker.db'),
      options: {
        timeout: 5000,
        readonly: false,
      },
    };

    dbManager = new DatabaseManager(config || defaultConfig);
  }
  return dbManager;
}

export function getDatabase(): Database.Database {
  if (!dbManager) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbManager.getDatabase();
}

export function closeDatabase(): void {
  if (dbManager) {
    dbManager.close();
    dbManager = null;
  }
}
