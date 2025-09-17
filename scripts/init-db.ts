#!/usr/bin/env node

/**
 * Database initialization script
 * Usage: npm run db:init
 */

import { initializeDatabase } from '../src/shared/database';
import * as fs from 'fs';
import * as path from 'path';

async function initializeDb() {
  console.log('🚀 Initializing KPI Tracker database...');
  
  try {
    // Initialize database and run migrations
    const dbManager = initializeDatabase();
    await dbManager.runMigrations();
    
    // Load seed data if in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('📝 Loading seed data...');
      const seedPath = path.join(process.cwd(), 'database', 'seeds', 'test_data.sql');
      
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf-8');
        dbManager.getDatabase().exec(seedSql);
        console.log('✅ Seed data loaded successfully');
      }
    }
    
    // Health check
    if (dbManager.healthCheck()) {
      console.log('✅ Database initialized successfully');
      console.log('📊 Database location:', path.join(process.cwd(), 'database', 'kpi-tracker.db'));
    } else {
      throw new Error('Database health check failed');
    }
    
    dbManager.close();
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDb();
}

export { initializeDb };
