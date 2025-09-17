/**
 * Simple Demo API Server
 * Basic version with health check and simple auth routes
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from '../shared/database';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database first
console.log('🔄 Initializing database...');
initializeDatabase();
console.log('✅ Database initialized');

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'API server running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Simple API routes for demonstration
app.get('/api/status', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API routes working',
    timestamp: new Date().toISOString()
  });
});

// Simple login endpoint for demo
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simple validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required',
        timestamp: new Date().toISOString()
      });
    }

    // Check demo credentials
    const validCredentials = [
      { email: 'manager@demo.com', password: 'password123', role: 'manager', firstName: 'Demo', lastName: 'Manager' },
      { email: 'employee@demo.com', password: 'password123', role: 'employee', firstName: 'Demo', lastName: 'Employee' }
    ];

    const user = validCredentials.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }

    // Return mock user data
    res.json({
      message: 'Login successful',
      token: 'demo-token-' + Date.now(),
      user: {
        id: user.email === 'manager@demo.com' ? 1 : 2,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: true
      },
      expiresIn: '24h',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Dashboard endpoint with mock data
app.get('/api/dashboard', (req, res) => {
  try {
    // Mock data that matches the dashboard structure
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
        { user: 'Demo Manager', action: 'Updated Q4 Revenue target', time: '2 hours ago' },
        { user: 'Demo Employee', action: 'Completed Customer Satisfaction KPI', time: '4 hours ago' },
        { user: 'Team Lead', action: 'Added new team member', time: '1 day ago' },
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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 KPI Tracker API server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
