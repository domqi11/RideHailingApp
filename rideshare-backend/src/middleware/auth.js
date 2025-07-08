const { verifyToken, errorResponse, sanitizeUser } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES, USER_ROLES } = require('../utils/constants');
const { supabaseAdmin } = require('../../config/database');

/**
 * Authentication middleware - verifies JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.UNAUTHORIZED, 
        'No token provided', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.UNAUTHORIZED, 
        'No token provided', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Fetch user from database to ensure user still exists and is active
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.USER_NOT_FOUND, 
        'User not found or inactive', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Attach user to request object (sanitized)
    req.user = sanitizeUser(user);
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return errorResponse(
      res, 
      MESSAGES.ERROR.INVALID_TOKEN, 
      error.message, 
      HTTP_STATUS.UNAUTHORIZED
    );
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (!error && user) {
      req.user = sanitizeUser(user);
      req.userId = user.id;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.UNAUTHORIZED, 
        'Authentication required', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.FORBIDDEN, 
        `Access denied. Required roles: ${roles.join(', ')}`, 
        HTTP_STATUS.FORBIDDEN
      );
    }

    next();
  };
};

/**
 * Customer only access
 */
const customerOnly = authorize(USER_ROLES.CUSTOMER, USER_ROLES.BOTH);

/**
 * Driver only access
 */
const driverOnly = authorize(USER_ROLES.DRIVER, USER_ROLES.BOTH);

/**
 * Check if user is a driver (has driver role and driver profile)
 */
const requireDriverProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.UNAUTHORIZED, 
        'Authentication required', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Check if user has driver role
    if (req.user.role !== USER_ROLES.DRIVER && req.user.role !== USER_ROLES.BOTH) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.FORBIDDEN, 
        'Driver access required', 
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Check if driver profile exists
    const { data: driverProfile, error } = await supabaseAdmin
      .from('driver_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error || !driverProfile) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.FORBIDDEN, 
        'Driver profile required', 
        HTTP_STATUS.FORBIDDEN
      );
    }

    req.driverProfile = driverProfile;
    next();
  } catch (error) {
    console.error('Driver profile check error:', error);
    return errorResponse(
      res, 
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR, 
      error.message, 
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Check if user owns the resource
 */
const checkOwnership = (resourceUserIdField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.UNAUTHORIZED, 
        'Authentication required', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Extract resource user ID from different sources
    let resourceUserId = null;
    
    if (req.resource && req.resource[resourceUserIdField]) {
      resourceUserId = req.resource[resourceUserIdField];
    } else if (req.params.userId) {
      resourceUserId = req.params.userId;
    } else if (req.body[resourceUserIdField]) {
      resourceUserId = req.body[resourceUserIdField];
    }

    if (!resourceUserId) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.BAD_REQUEST, 
        'Resource user ID not found', 
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (req.userId !== resourceUserId) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.FORBIDDEN, 
        'Access denied. You can only access your own resources.', 
        HTTP_STATUS.FORBIDDEN
      );
    }

    next();
  };
};

/**
 * Check if user is customer or driver in a ride
 */
const checkRideAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.UNAUTHORIZED, 
        'Authentication required', 
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const rideId = req.params.rideId || req.params.id;
    
    if (!rideId) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.BAD_REQUEST, 
        'Ride ID required', 
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Fetch ride to check access
    const { data: ride, error } = await supabaseAdmin
      .from('rides')
      .select('customer_id, driver_id')
      .eq('id', rideId)
      .single();

    if (error || !ride) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.RIDE_NOT_FOUND, 
        'Ride not found', 
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Check if user is either customer or driver of this ride
    if (req.userId !== ride.customer_id && req.userId !== ride.driver_id) {
      return errorResponse(
        res, 
        MESSAGES.ERROR.FORBIDDEN, 
        'Access denied. You are not associated with this ride.', 
        HTTP_STATUS.FORBIDDEN
      );
    }

    req.ride = ride;
    next();
  } catch (error) {
    console.error('Ride access check error:', error);
    return errorResponse(
      res, 
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR, 
      error.message, 
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Rate limiting middleware wrapper
 */
const createRateLimit = (windowMs, max, message) => {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.',
      error: 'Rate limit exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  customerOnly,
  driverOnly,
  requireDriverProfile,
  checkOwnership,
  checkRideAccess,
  createRateLimit
}; 