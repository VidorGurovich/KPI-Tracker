/**
 * Create Demo Users Script
 * Creates demo users with proper password hashing for testing
 */

import bcrypt from 'bcrypt';
import { initializeDatabase, getDatabase } from '../src/shared/database';

async function createDemoUsers() {
  console.log('🔄 Creating demo users...');
  
  try {
    // Initialize database
    initializeDatabase();
    const db = getDatabase();
    
    // Hash the demo passwords
    const managerPassword = await bcrypt.hash('password123', 10);
    const employeePassword = await bcrypt.hash('password123', 10);
    
    // Delete existing demo users if they exist
    db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(
      'manager@demo.com',
      'employee@demo.com'
    );
    
    // Insert demo users
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    insertUser.run(
      'manager@demo.com',
      managerPassword,
      'Demo',
      'Manager',
      'manager',
      1
    );
    
    insertUser.run(
      'employee@demo.com',
      employeePassword,
      'Demo',
      'Employee',
      'employee',
      1
    );
    
    console.log('✅ Demo users created successfully:');
    console.log('   Manager: manager@demo.com / password123');
    console.log('   Employee: employee@demo.com / password123');
    
  } catch (error) {
    console.error('❌ Failed to create demo users:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createDemoUsers();
}

export { createDemoUsers };
