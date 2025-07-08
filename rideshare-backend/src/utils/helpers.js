const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { HTTP_STATUS, MESSAGES, GEO_CONSTANTS, VALIDATION } = require('./constants');

/**
 * Standard API response format
 */
const createResponse = (success, message, data = null, error = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (error !== null) {
    response.error = error;
  }

  return response;
};

/**
 * Success response helper
 */
const successResponse = (res, message, data = null, statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json(createResponse(true, message, data));
};

/**
 * Error response helper
 */
const errorResponse = (res, message, error = null, statusCode = HTTP_STATUS.BAD_REQUEST) => {
  return res.status(statusCode).json(createResponse(false, message, null, error));
};

/**
 * JWT token generation
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * JWT token verification
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Password hashing
 */
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Password comparison
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Generate UUID
 */
const generateUUID = () => {
  return uuidv4();
};

/**
 * Calculate distance between two points using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = GEO_CONSTANTS.EARTH_RADIUS_KM; // Earth's radius in kilometers
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in kilometers
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate estimated fare based on distance
 */
const calculateFare = (distanceKm, baseFare = 5.0, perKmRate = 2.5) => {
  return baseFare + (distanceKm * perKmRate);
};

/**
 * Estimate trip duration in minutes
 */
const estimateDuration = (distanceKm, averageSpeedKmh = 40) => {
  return Math.ceil((distanceKm / averageSpeedKmh) * 60); // Convert to minutes
};

/**
 * Validate coordinates
 */
const isValidCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= VALIDATION.LATITUDE_RANGE[0] &&
    latitude <= VALIDATION.LATITUDE_RANGE[1] &&
    longitude >= VALIDATION.LONGITUDE_RANGE[0] &&
    longitude <= VALIDATION.LONGITUDE_RANGE[1]
  );
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  return VALIDATION.EMAIL_REGEX.test(email);
};

/**
 * Validate phone number format
 */
const isValidPhone = (phone) => {
  return VALIDATION.PHONE_REGEX.test(phone);
};

/**
 * Validate password strength
 */
const isValidPassword = (password) => {
  return password && password.length >= VALIDATION.PASSWORD_MIN_LENGTH;
};

/**
 * Sanitize user data for response (remove sensitive fields)
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  
  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
};

/**
 * Pagination helper
 */
const paginate = (page = 1, limit = 20) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
  const offset = (pageNum - 1) * limitNum;
  
  return {
    limit: limitNum,
    offset,
    page: pageNum
  };
};

/**
 * Format pagination response
 */
const formatPaginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Generate random string
 */
const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Format date for consistent output
 */
const formatDate = (date) => {
  return new Date(date).toISOString();
};

/**
 * Check if point is within radius
 */
const isWithinRadius = (centerLat, centerLng, pointLat, pointLng, radiusKm) => {
  const distance = calculateDistance(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusKm;
};

/**
 * Convert meters to kilometers
 */
const metersToKm = (meters) => {
  return meters / 1000;
};

/**
 * Convert kilometers to meters
 */
const kmToMeters = (km) => {
  return km * 1000;
};

/**
 * Delay function for testing/development
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Log function with timestamp
 */
const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data, null, 2) : '';
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message} ${logData}`);
};

/**
 * Extract coordinates from location object
 */
const extractCoordinates = (location) => {
  if (!location) return null;
  
  // Handle different location formats from React Native app
  if (location.latitude && location.longitude) {
    return {
      latitude: parseFloat(location.latitude),
      longitude: parseFloat(location.longitude)
    };
  }
  
  if (location.coords) {
    return {
      latitude: parseFloat(location.coords.latitude),
      longitude: parseFloat(location.coords.longitude)
    };
  }
  
  return null;
};

module.exports = {
  createResponse,
  successResponse,
  errorResponse,
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateUUID,
  calculateDistance,
  calculateFare,
  estimateDuration,
  isValidCoordinates,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  sanitizeUser,
  paginate,
  formatPaginatedResponse,
  asyncHandler,
  generateRandomString,
  formatDate,
  isWithinRadius,
  metersToKm,
  kmToMeters,
  delay,
  log,
  extractCoordinates
}; 