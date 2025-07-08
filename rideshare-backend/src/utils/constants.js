// User roles
const USER_ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  BOTH: 'both'
};

// Ride statuses
const RIDE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Payment statuses
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Ride request statuses
const REQUEST_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  ACCEPTED: 'accepted',
  CANCELLED: 'cancelled'
};

// WebSocket events
const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  LOCATION_UPDATE: 'location-update',
  RIDE_UPDATE: 'ride-update',
  RIDE_REQUEST: 'ride-request',
  RIDE_ACCEPTED: 'ride-accepted',
  RIDE_CANCELLED: 'ride-cancelled',
  DRIVER_LOCATION: 'driver-location',
  ERROR: 'error'
};

// API response messages
const MESSAGES = {
  SUCCESS: {
    USER_REGISTERED: 'User registered successfully',
    USER_LOGIN: 'Login successful',
    USER_LOGOUT: 'Logout successful',
    PROFILE_UPDATED: 'Profile updated successfully',
    RIDE_REQUESTED: 'Ride requested successfully',
    RIDE_ACCEPTED: 'Ride accepted successfully',
    RIDE_CANCELLED: 'Ride cancelled successfully',
    RIDE_COMPLETED: 'Ride completed successfully',
    LOCATION_UPDATED: 'Location updated successfully',
    DRIVER_AVAILABILITY_UPDATED: 'Driver availability updated'
  },
  ERROR: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    USER_NOT_FOUND: 'User not found',
    EMAIL_ALREADY_EXISTS: 'Email already exists',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    VALIDATION_ERROR: 'Validation error',
    RIDE_NOT_FOUND: 'Ride not found',
    DRIVER_NOT_AVAILABLE: 'Driver not available',
    NO_DRIVERS_NEARBY: 'No drivers available nearby',
    RIDE_ALREADY_ACCEPTED: 'Ride already accepted by another driver',
    INVALID_RIDE_STATUS: 'Invalid ride status transition',
    LOCATION_UPDATE_FAILED: 'Failed to update location',
    INTERNAL_SERVER_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database operation failed',
    INVALID_TOKEN: 'Invalid or expired token',
    MISSING_FIELDS: 'Required fields are missing'
  }
};

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};

// Geographic constants
const GEO_CONSTANTS = {
  EARTH_RADIUS_KM: 6371,
  MAX_SEARCH_RADIUS_KM: process.env.MAX_DRIVER_SEARCH_RADIUS_KM || 10,
  DEFAULT_SEARCH_RADIUS_KM: process.env.DEFAULT_SEARCH_RADIUS_KM || 5,
  MAX_PICKUP_DISTANCE_KM: 2,
  LOCATION_UPDATE_INTERVAL_MS: 5000,
  LOCATION_TIMEOUT_MS: 30000
};

// Rate limiting
const RATE_LIMITS = {
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 attempts per window
  },
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
  },
  LOCATION: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60 // 60 location updates per minute
  }
};

// Validation rules
const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  LATITUDE_RANGE: [-90, 90],
  LONGITUDE_RANGE: [-180, 180]
};

// Database table names
const TABLES = {
  USERS: 'users',
  DRIVER_PROFILES: 'driver_profiles',
  RIDES: 'rides',
  USER_LOCATIONS: 'user_locations',
  RIDE_REQUESTS: 'ride_requests'
};

// WebSocket rooms
const SOCKET_ROOMS = {
  DRIVERS: 'drivers',
  CUSTOMERS: 'customers',
  RIDE: (rideId) => `ride_${rideId}`,
  USER: (userId) => `user_${userId}`
};

// Default values
const DEFAULTS = {
  DRIVER_RATING: 5.0,
  RIDE_REQUEST_EXPIRY_MINUTES: 10,
  JWT_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
};

module.exports = {
  USER_ROLES,
  RIDE_STATUS,
  PAYMENT_STATUS,
  REQUEST_STATUS,
  SOCKET_EVENTS,
  MESSAGES,
  HTTP_STATUS,
  GEO_CONSTANTS,
  RATE_LIMITS,
  VALIDATION,
  TABLES,
  SOCKET_ROOMS,
  DEFAULTS
}; 