const express = require('express');
const { authenticate, driverOnly, requireDriverProfile } = require('../middleware/auth');
const { validateDriver, validateLocation, validateCommon } = require('../middleware/validation');
const { DriverService, LocationService } = require('../services/databaseService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');

const router = express.Router();

/**
 * @route   POST /api/drivers/profile
 * @desc    Create driver profile
 * @access  Private (Driver role required)
 */
router.post('/profile', 
  authenticate,
  driverOnly,
  validateDriver.createProfile,
  asyncHandler(async (req, res) => {
    try {
      // Check if driver profile already exists
      const existingProfile = await DriverService.getProfileByUserId(req.userId);
      if (existingProfile) {
        return errorResponse(
          res,
          'Driver profile already exists',
          'You already have a driver profile. Use PUT to update it.',
          HTTP_STATUS.CONFLICT
        );
      }

      const profileData = req.body;
      const driverProfile = await DriverService.createProfile(req.userId, profileData);
      
      successResponse(
        res,
        'Driver profile created successfully',
        { driver_profile: driverProfile },
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      console.error('Create driver profile error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

/**
 * @route   GET /api/drivers/profile
 * @desc    Get current driver profile
 * @access  Private (Driver role required)
 */
router.get('/profile', 
  authenticate,
  driverOnly,
  asyncHandler(async (req, res) => {
    try {
      const driverProfile = await DriverService.getProfileByUserId(req.userId);
      
      if (!driverProfile) {
        return errorResponse(
          res,
          'Driver profile not found',
          'You need to create a driver profile first.',
          HTTP_STATUS.NOT_FOUND
        );
      }

      successResponse(
        res,
        'Driver profile retrieved successfully',
        { driver_profile: driverProfile },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get driver profile error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

/**
 * @route   PUT /api/drivers/profile
 * @desc    Update driver profile
 * @access  Private (Driver role required)
 */
router.put('/profile',
  authenticate,
  driverOnly,
  validateDriver.updateProfile,
  asyncHandler(async (req, res) => {
    try {
      const updateData = req.body;
      const updatedProfile = await DriverService.updateProfile(req.userId, updateData);
      
      successResponse(
        res,
        'Driver profile updated successfully',
        { driver_profile: updatedProfile },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Update driver profile error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

/**
 * @route   PUT /api/drivers/availability
 * @desc    Update driver availability status
 * @access  Private (Driver with profile required)
 */
router.put('/availability',
  authenticate,
  requireDriverProfile,
  validateDriver.updateAvailability,
  asyncHandler(async (req, res) => {
    try {
      const { is_available } = req.body;
      const updatedProfile = await DriverService.updateAvailability(req.userId, is_available);
      
      successResponse(
        res,
        MESSAGES.SUCCESS.DRIVER_AVAILABILITY_UPDATED,
        { 
          driver_profile: updatedProfile,
          message: `You are now ${is_available ? 'available' : 'unavailable'} for rides`
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Update availability error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

/**
 * @route   GET /api/drivers/nearby
 * @desc    Find nearby available drivers (for customers)
 * @access  Private
 */
router.get('/nearby',
  authenticate,
  validateLocation.nearbyDrivers,
  asyncHandler(async (req, res) => {
    try {
      const { latitude, longitude, radius = 5 } = req.query;
      const limit = parseInt(req.query.limit) || 20;
      
      const nearbyDrivers = await DriverService.findNearbyAvailableDrivers(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        limit
      );
      
      successResponse(
        res,
        'Nearby drivers retrieved successfully',
        { 
          drivers: nearbyDrivers,
          count: nearbyDrivers.length,
          search_params: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            radius: parseFloat(radius)
          }
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Find nearby drivers error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

/**
 * @route   GET /api/drivers/:driverId
 * @desc    Get public driver information
 * @access  Private
 */
router.get('/:driverId',
  authenticate,
  validateCommon.id,
  asyncHandler(async (req, res) => {
    try {
      const { driverId } = req.params;
      const driverProfile = await DriverService.getProfileByUserId(driverId);
      
      if (!driverProfile) {
        return errorResponse(
          res,
          'Driver not found',
          'Driver profile not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      // Return only public driver information
      const publicDriverInfo = {
        id: driverProfile.id,
        user_id: driverProfile.user_id,
        first_name: driverProfile.users?.first_name,
        last_name: driverProfile.users?.last_name,
        rating: driverProfile.rating,
        total_rides: driverProfile.total_rides,
        vehicle_make: driverProfile.vehicle_make,
        vehicle_model: driverProfile.vehicle_model,
        vehicle_year: driverProfile.vehicle_year,
        is_available: driverProfile.is_available
      };

      successResponse(
        res,
        'Driver information retrieved successfully',
        { driver: publicDriverInfo },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get driver info error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

module.exports = router; 