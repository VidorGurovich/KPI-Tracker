/**
 * KPI Tracker Production API Server
 * Full-featured API server with authentication and team management
 */

import express from 'express';
import { initializeDatabase } from '../shared/database';
import apiRoutes from '../main/api';

const app = express();
const PORT = process.env.API_PORT || 3002; // Use different port to avoid conflicts

// Initialize database first
console.log('🔄 Initializing database...');
initializeDatabase();
console.log('✅ Database initialized');

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for proper IP handling behind reverse proxies
app.set('trust proxy', 1);

// Mount API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'KPI Tracker Production API Server',
    version: '1.0.0',
    documentation: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 KPI Tracker Production API server running on port', PORT);
  console.log('📊 Health check: http://localhost:' + PORT + '/api/health');
  console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
  console.log('⚡ Ready to accept requests!');
});

export default app;
