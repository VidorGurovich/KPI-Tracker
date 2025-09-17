/**
 * Express Application Setup
 * Main entry point for the KPI Tracker API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from '../shared/database';

// Initialize database first
console.log('🔄 Initializing database...');
initializeDatabase();
console.log('✅ Database initialized');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes after database initialization
import { authRouter } from './routes/auth';

// API Routes
app.use('/api/auth', authRouter);

// Simple dashboard endpoint for now
app.get('/api/dashboard', async (req, res) => {
  try {
    // For now, return mock data that matches the dashboard structure
    const dashboardData = {
      kpis: [
        {
          title: "Active KPIs",
          value: 8,
          target: 10,
          trend: { current: 8, previous: 6 },
          icon: "target",
          color: "text-blue-600"
        },
        {
          title: "Team Members",
          value: 5,
          target: 8,
          trend: { current: 5, previous: 4 },
          icon: "users",
          color: "text-green-600"
        },
        {
          title: "Completed Goals",
          value: 12,
          target: 15,
          trend: { current: 12, previous: 10 },
          icon: "check-circle",
          color: "text-purple-600"
        },
        {
          title: "Average Score",
          value: 85.5,
          target: 90,
          trend: { current: 85.5, previous: 82.3 },
          icon: "trending-up",
          color: "text-orange-600"
        }
      ],
      recentActivity: [
        { user: 'John Doe', action: 'Updated Q4 Revenue target', time: '2 hours ago' },
        { user: 'Jane Smith', action: 'Completed Customer Satisfaction KPI', time: '4 hours ago' },
        { user: 'Mike Johnson', action: 'Added new team member', time: '1 day ago' },
      ],
      user: {
        stats: {
          totalKpis: 8,
          completedKpis: 12,
          teamSize: 5,
          averageScore: 85.5
        }
      }
    };

    res.json({
      message: 'Dashboard data retrieved successfully',
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Basic error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 KPI Tracker API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
export { server };

export default app;
