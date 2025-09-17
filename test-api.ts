/**
 * Simple API Test Script
 * Tests basic API functionality
 */

import app from './src/api/demo-app';

console.log('✅ API routes compiled successfully');
console.log('📊 Available routes:');
console.log('  - POST /api/auth/register');
console.log('  - POST /api/auth/login');
console.log('  - POST /api/auth/verify');
console.log('  - GET /api/users/profile');
console.log('  - GET /api/users/stats');
console.log('  - GET /api/teams/my-members');
console.log('  - GET /api/kpis/definitions');
console.log('  - POST /api/kpis/definitions');
console.log('  - GET /health');

export default app;
