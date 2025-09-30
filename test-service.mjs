// Test importing AuthenticationService
import { AuthenticationService } from './src/services/AuthenticationService.js';

console.log('Testing AuthenticationService import...');
try {
  const service = new AuthenticationService({
    jwtSecret: 'test-secret',
    jwtExpiresIn: '24h',
    refreshTokenExpiresIn: '7d',
    passwordResetTokenExpiresIn: '1h',
    emailVerificationTokenExpiresIn: '24h'
  });
  console.log('✅ AuthenticationService imported successfully');
} catch (error) {
  console.error('❌ Error importing AuthenticationService:', error.message);
}