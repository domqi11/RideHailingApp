const Joi = require('joi');
const { errorResponse } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES, VALIDATION } = require('../utils/constants');

/**
 * Validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return errorResponse(
        res,
        MESSAGES.ERROR.VALIDATION_ERROR,
        errorDetails,
        HTTP_STATUS.BAD_REQUEST
      );
    }
    
    next();
  };
};

// Common validation schemas
const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(VALIDATION.PASSWORD_MIN_LENGTH).required(),
  name: Joi.string().min(VALIDATION.NAME_MIN_LENGTH).max(VALIDATION.NAME_MAX_LENGTH).required(),
  phone: Joi.string().pattern(VALIDATION.PHONE_REGEX).optional(),
  latitude: Joi.number().min(VALIDATION.LATITUDE_RANGE[0]).max(VALIDATION.LATITUDE_RANGE[1]).required(),
  longitude: Joi.number().min(VALIDATION.LONGITUDE_RANGE[0]).max(VALIDATION.LONGITUDE_RANGE[1]).required(),
  address: Joi.string().min(5).max(200).required(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }
};

// Authentication schemas
const authSchemas = {
  register: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    first_name: commonSchemas.name,
    last_name: commonSchemas.name,
    phone: commonSchemas.phone,
    role: Joi.string().valid('customer', 'driver', 'both').default('customer')
  }),
  
  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required()
  })
};

// User schemas
const userSchemas = {
  updateProfile: Joi.object({
    first_name: Joi.string().min(VALIDATION.NAME_MIN_LENGTH).max(VALIDATION.NAME_MAX_LENGTH).optional(),
    last_name: Joi.string().min(VALIDATION.NAME_MIN_LENGTH).max(VALIDATION.NAME_MAX_LENGTH).optional(),
    phone: commonSchemas.phone,
    profile_picture_url: Joi.string().uri().optional()
  }).min(1), // At least one field must be provided
  
  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: commonSchemas.password
  })
};

// Driver schemas
const driverSchemas = {
  createProfile: Joi.object({
    license_number: Joi.string().min(5).max(20).required(),
    vehicle_make: Joi.string().min(2).max(50).optional(),
    vehicle_model: Joi.string().min(2).max(50).optional(),
    vehicle_year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    vehicle_plate: Joi.string().min(2).max(10).optional()
  }),
  
  updateProfile: Joi.object({
    license_number: Joi.string().min(5).max(20).optional(),
    vehicle_make: Joi.string().min(2).max(50).optional(),
    vehicle_model: Joi.string().min(2).max(50).optional(),
    vehicle_year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    vehicle_plate: Joi.string().min(2).max(10).optional()
  }).min(1),
  
  updateAvailability: Joi.object({
    is_available: Joi.boolean().required()
  })
};

// Location schemas
const locationSchemas = {
  updateLocation: Joi.object({
    latitude: commonSchemas.latitude,
    longitude: commonSchemas.longitude,
    heading: Joi.number().min(0).max(360).optional()
  }),
  
  searchNearby: Joi.object({
    latitude: commonSchemas.latitude,
    longitude: commonSchemas.longitude,
    radius: Joi.number().min(0.1).max(50).default(5), // 0.1km to 50km
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

// Ride schemas
const rideSchemas = {
  requestRide: Joi.object({
    pickup_location: Joi.object({
      latitude: commonSchemas.latitude,
      longitude: commonSchemas.longitude,
      address: commonSchemas.address
    }).required(),
    destination: Joi.object({
      latitude: commonSchemas.latitude,
      longitude: commonSchemas.longitude,
      address: commonSchemas.address
    }).required(),
    stops: Joi.array().items(
      Joi.object({
        latitude: commonSchemas.latitude,
        longitude: commonSchemas.longitude,
        address: commonSchemas.address,
        order: Joi.number().integer().min(1).required()
      })
    ).optional(),
    estimated_fare: Joi.number().min(0).optional(),
    notes: Joi.string().max(500).optional()
  }),
  
  updateRideStatus: Joi.object({
    status: Joi.string().valid('pending', 'accepted', 'in_progress', 'completed', 'cancelled').required(),
    notes: Joi.string().max(500).optional()
  }),
  
  rateRide: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(500).optional()
  })
};

// Query parameter schemas
const querySchemas = {
  pagination: Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }),
  
  rideHistory: Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    status: Joi.string().valid('pending', 'accepted', 'in_progress', 'completed', 'cancelled').optional(),
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().min(Joi.ref('from_date')).optional()
  }),
  
  nearbyDrivers: Joi.object({
    latitude: commonSchemas.latitude,
    longitude: commonSchemas.longitude,
    radius: Joi.number().min(0.1).max(50).default(5)
  })
};

// Parameter schemas
const paramSchemas = {
  userId: Joi.object({
    userId: commonSchemas.uuid
  }),
  
  rideId: Joi.object({
    rideId: commonSchemas.uuid
  }),
  
  id: Joi.object({
    id: commonSchemas.uuid
  })
};

// Validation middleware functions
const validateAuth = {
  register: validate(authSchemas.register),
  login: validate(authSchemas.login)
};

const validateUser = {
  updateProfile: validate(userSchemas.updateProfile),
  changePassword: validate(userSchemas.changePassword),
  userId: validate(paramSchemas.userId, 'params')
};

const validateDriver = {
  createProfile: validate(driverSchemas.createProfile),
  updateProfile: validate(driverSchemas.updateProfile),
  updateAvailability: validate(driverSchemas.updateAvailability)
};

const validateLocation = {
  updateLocation: validate(locationSchemas.updateLocation),
  searchNearby: validate(locationSchemas.searchNearby, 'query'),
  nearbyDrivers: validate(querySchemas.nearbyDrivers, 'query')
};

const validateRide = {
  requestRide: validate(rideSchemas.requestRide),
  updateStatus: validate(rideSchemas.updateRideStatus),
  rateRide: validate(rideSchemas.rateRide),
  rideId: validate(paramSchemas.rideId, 'params'),
  history: validate(querySchemas.rideHistory, 'query')
};

const validateCommon = {
  pagination: validate(querySchemas.pagination, 'query'),
  id: validate(paramSchemas.id, 'params')
};

/**
 * Custom validation middleware for complex scenarios
 */
const customValidations = {
  // Validate coordinates are within reasonable bounds for Australia
  validateAustralianCoordinates: (req, res, next) => {
    const { latitude, longitude } = req.body;
    
    // Rough bounds for Australia
    const australiaBounds = {
      minLat: -44.0,
      maxLat: -10.0,
      minLng: 113.0,
      maxLng: 154.0
    };
    
    if (latitude < australiaBounds.minLat || latitude > australiaBounds.maxLat ||
        longitude < australiaBounds.minLng || longitude > australiaBounds.maxLng) {
      
      console.warn(`Coordinates outside Australia bounds: ${latitude}, ${longitude}`);
      // Don't fail validation, just log warning for monitoring
    }
    
    next();
  },
  
  // Validate ride status transitions
  validateStatusTransition: async (req, res, next) => {
    if (!req.body.status) return next();
    
    const { status } = req.body;
    const rideId = req.params.rideId || req.params.id;
    
    try {
      // Get current ride status
      const { supabaseAdmin } = require('../../config/database');
      const { data: ride } = await supabaseAdmin
        .from('rides')
        .select('status')
        .eq('id', rideId)
        .single();
      
      if (!ride) return next();
      
      const currentStatus = ride.status;
      
      // Define valid status transitions
      const validTransitions = {
        'pending': ['accepted', 'cancelled'],
        'accepted': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'cancelled'],
        'completed': [], // Terminal state
        'cancelled': [] // Terminal state
      };
      
      if (!validTransitions[currentStatus]?.includes(status)) {
        return errorResponse(
          res,
          MESSAGES.ERROR.INVALID_RIDE_STATUS,
          `Cannot transition from ${currentStatus} to ${status}`,
          HTTP_STATUS.BAD_REQUEST
        );
      }
      
      next();
    } catch (error) {
      console.error('Status transition validation error:', error);
      next(); // Continue on validation error
    }
  }
};

/**
 * Error handling middleware for validation errors
 */
const handleValidationErrors = (error, req, res, next) => {
  if (error.isJoi || error.name === 'ValidationError') {
    const errorDetails = error.details ? error.details.map(detail => ({
      field: detail.path?.join('.') || 'unknown',
      message: detail.message
    })) : [{ field: 'unknown', message: error.message }];
    
    return errorResponse(
      res,
      MESSAGES.ERROR.VALIDATION_ERROR,
      errorDetails,
      HTTP_STATUS.BAD_REQUEST
    );
  }
  
  next(error);
};

module.exports = {
  validate,
  validateAuth,
  validateUser,
  validateDriver,
  validateLocation,
  validateRide,
  validateCommon,
  customValidations,
  handleValidationErrors,
  commonSchemas,
  authSchemas,
  userSchemas,
  driverSchemas,
  locationSchemas,
  rideSchemas,
  querySchemas,
  paramSchemas
}; 