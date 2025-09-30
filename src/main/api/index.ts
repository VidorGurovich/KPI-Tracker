/**
 * Main API Router
 * Aggregates all API routes and applies common middleware
 */

import { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import route modules
import authRoutes from './auth';
import teamsRoutes from './teams';

const router = Router();

// Global API middleware
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

router.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(globalLimiter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'KPI Tracker API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/teams', teamsRoutes);

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl
  });
});

export default router;
