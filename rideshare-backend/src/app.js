require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');

// Import configurations and utilities
const { testConnection, initializeTables } = require('../config/database');
const { HTTP_STATUS, MESSAGES, RATE_LIMITS } = require('./utils/constants');
const { errorResponse, log } = require('./utils/helpers');
const { createRateLimit } = require('./middleware/auth');
const { handleValidationErrors } = require('./middleware/validation');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const driverRoutes = require('./routes/drivers');
const rideRoutes = require('./routes/rides');
const locationRoutes = require('./routes/locations');

// Import WebSocket handlers
const { initializeWebSocket } = require('./services/websocketService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io available to routes
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Compression middleware
app.use(compression());

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:8085',
      'exp://localhost:8081',
      'exp://192.168.0.4:8085', // Your current Expo setup
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow for development - restrict in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => log('info', message.trim())
    }
  }));
}

// Health check endpoint (before rate limiting)
app.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Rideshare backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Rate limiting
app.use('/api/auth', createRateLimit(
  RATE_LIMITS.AUTH.windowMs, 
  RATE_LIMITS.AUTH.max,
  'Too many authentication attempts, please try again later.'
));

app.use('/api/locations', createRateLimit(
  RATE_LIMITS.LOCATION.windowMs,
  RATE_LIMITS.LOCATION.max,
  'Too many location updates, please slow down.'
));

app.use('/api', createRateLimit(
  RATE_LIMITS.GENERAL.windowMs,
  RATE_LIMITS.GENERAL.max,
  'Too many requests, please try again later.'
));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/locations', locationRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Rideshare API v1.0',
    documentation: 'See README.md for API documentation',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      drivers: '/api/drivers',
      rides: '/api/rides',
      locations: '/api/locations'
    },
    websocket: {
      endpoint: '/socket.io',
      events: [
        'connection',
        'join-room', 
        'location-update',
        'ride-update',
        'ride-request',
        'ride-accepted',
        'ride-cancelled'
      ]
    }
  });
});

// Handle 404 errors
app.use('*', (req, res) => {
  errorResponse(
    res,
    'Endpoint not found',
    `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    HTTP_STATUS.NOT_FOUND
  );
});

// Validation error handling middleware
app.use(handleValidationErrors);

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Database connection errors
  if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
    return errorResponse(
      res,
      MESSAGES.ERROR.DATABASE_ERROR,
      'Database connection failed',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return errorResponse(
      res,
      MESSAGES.ERROR.INVALID_TOKEN,
      error.message,
      HTTP_STATUS.UNAUTHORIZED
    );
  }
  
  // Default error response
  errorResponse(
    res,
    MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
    process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
});

// Initialize WebSocket handlers
initializeWebSocket(io);

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed successfully');
    
    // Close database connections if needed
    // supabase connections are handled automatically
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.log('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server function
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const connectionTest = await testConnection();
    
    if (!connectionTest) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }
    
    // Initialize database tables if needed
    await initializeTables();
    
    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║                🚗 RIDESHARE BACKEND                   ║
║                                                      ║
║  Server running on port: ${PORT.toString().padEnd(28)} ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(35)} ║
║  Database: Connected ✅                              ║
║  WebSocket: Enabled ✅                               ║
║                                                      ║
║  API Documentation: http://localhost:${PORT}/api        ║
║  Health Check: http://localhost:${PORT}/health          ║
║                                                      ║
║  Ready to handle ride requests! 🚀                   ║
╚══════════════════════════════════════════════════════╝
      `);
      
      log('info', `Rideshare backend started on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Export for testing
module.exports = { app, server, startServer };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
} 