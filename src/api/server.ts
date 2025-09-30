/**
 * Server Startup Script
 * Ensures proper initialization order for database and routes
 */

import { initializeDatabase } from '../shared/database';

// Initialize database first
console.log('🔄 Initializing database...');
initializeDatabase();
console.log('✅ Database initialized');

// Now import and start the app
import('./app').then((appModule) => {
  console.log('📦 Application modules loaded successfully');
  // Keep the process alive
  process.on('SIGTERM', () => {
    console.log('� Shutting down gracefully...');
    process.exit(0);
  });
}).catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
