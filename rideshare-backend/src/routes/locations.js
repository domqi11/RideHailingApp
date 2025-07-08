const express = require('express');
const { authenticate, driverOnly } = require('../middleware/auth');
const { validateLocation, validateCommon } = require('../middleware/validation');
const { LocationService, DriverService } = require('../services/databaseService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');

const router = express.Router();

/**
 * @route   POST /api/locations/update
 * @desc    Update user's current location
 * @access  Private
 */
router.post('/update',
  authenticate,
  validateLocation.updateLocation,
  asyncHandler(async (req, res) => {
    try {
      const { latitude, longitude, heading } = req.body;
      
      const location = await LocationService.updateUserLocation(
        req.userId,
        latitude,
        longitude,
        heading
      );
      
      // Emit location update via WebSocket for real-time tracking
      const io = req.app.get('io');
      if (io) {
        // Emit to user's own room
        io.to(`user_${req.userId}`).emit('location-update', {
          userId: req.userId,
          latitude,
          longitude,
          heading,
          timestamp: location.updated_at
        });
        
        // If user is a driver, emit to customers room for nearby driver tracking
        if (req.user.role === 'driver' || req.user.role === 'both') {
          io.to('customers').emit('driver-location', {
            driverId: req.userId,
            latitude,
            longitude,
            heading,
            timestamp: location.updated_at
          });
        }
      }
      
      successResponse(
        res,
        MESSAGES.SUCCESS.LOCATION_UPDATED,
        { location },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Update location error:', error);
      errorResponse(
        res,
        MESSAGES.ERROR.LOCATION_UPDATE_FAILED,
        error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  })
);

/**
 * @route   GET /api/locations/nearby-drivers
 * @desc    Get nearby available drivers (for customers)
 * @access  Private
 */
router.get('/nearby-drivers',
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
      
      // Filter and format driver data for customers
      const formattedDrivers = nearbyDrivers.map(driver => ({
        driver_id: driver.user_id,
        name: `${driver.users?.first_name} ${driver.users?.last_name}`,
        rating: driver.rating,
        total_rides: driver.total_rides,
        vehicle: {
          make: driver.vehicle_make,
          model: driver.vehicle_model,
          year: driver.vehicle_year
        },
        location: {
          latitude: driver.location.latitude,
          longitude: driver.location.longitude,
          updated_at: driver.location.updated_at
        },
        distance_km: Math.round(driver.distance * 100) / 100, // Round to 2 decimal places
        estimated_arrival_minutes: Math.ceil(driver.distance * 2) // Rough estimate: 2 min per km
      }));
      
      successResponse(
        res,
        'Nearby drivers retrieved successfully',
        { 
          drivers: formattedDrivers,
          count: formattedDrivers.length,
          search_center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            radius_km: parseFloat(radius)
          }
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get nearby drivers error:', error);
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
 * @route   GET /api/locations/:userId
 * @desc    Get specific user's location (for ride participants)
 * @access  Private
 */
router.get('/:userId',
  authenticate,
  validateCommon.id,
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Basic access control - users can see their own location or locations of users they're riding with
      // For now, allow authenticated users to see locations (expand access control as needed)
      
      const location = await LocationService.getUserLocation(userId);
      
      if (!location) {
        return errorResponse(
          res,
          'Location not found',
          'User location not available',
          HTTP_STATUS.NOT_FOUND
        );
      }
      
      // Check if location is recent (within last 5 minutes)
      const locationAge = new Date() - new Date(location.updated_at);
      const isRecent = locationAge < 5 * 60 * 1000; // 5 minutes in milliseconds
      
      successResponse(
        res,
        'User location retrieved successfully',
        { 
          location: {
            user_id: location.user_id,
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading,
            updated_at: location.updated_at,
            is_recent: isRecent,
            age_minutes: Math.floor(locationAge / (1000 * 60))
          }
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get user location error:', error);
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
 * @route   DELETE /api/locations/clear
 * @desc    Clear user's location data
 * @access  Private
 */
router.delete('/clear',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      await LocationService.deleteUserLocation(req.userId);
      
      // Emit location cleared event via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${req.userId}`).emit('location-cleared', {
          userId: req.userId,
          timestamp: new Date().toISOString()
        });
        
        // If user is a driver, notify customers that driver location is no longer available
        if (req.user.role === 'driver' || req.user.role === 'both') {
          io.to('customers').emit('driver-location-cleared', {
            driverId: req.userId,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      successResponse(
        res,
        'Location data cleared successfully',
        { message: 'Your location has been removed from our system' },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Clear location error:', error);
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
 * @route   GET /api/locations/search/nearby
 * @desc    Generic nearby location search
 * @access  Private
 */
router.get('/search/nearby',
  authenticate,
  validateLocation.searchNearby,
  asyncHandler(async (req, res) => {
    try {
      const { latitude, longitude, radius = 5, limit = 50 } = req.query;
      
      // Get all users within radius (could be used for various features)
      const nearbyUsers = await LocationService.findNearbyUsers(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        parseInt(limit)
      );
      
      // Filter out sensitive information and only return basic data
      const formattedUsers = nearbyUsers.map(user => ({
        user_id: user.user_id,
        distance_km: Math.round(user.distance * 100) / 100,
        location_age_minutes: Math.floor((new Date() - new Date(user.updated_at)) / (1000 * 60))
      }));
      
      successResponse(
        res,
        'Nearby users retrieved successfully',
        { 
          users: formattedUsers,
          count: formattedUsers.length,
          search_center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            radius_km: parseFloat(radius)
          }
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Nearby search error:', error);
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
 * @route   POST /api/locations/batch-update
 * @desc    Update multiple users' locations (for testing/admin)
 * @access  Private
 */
router.post('/batch-update',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { locations } = req.body;
      
      if (!locations || !Array.isArray(locations)) {
        return errorResponse(
          res,
          'Invalid request format',
          'Locations array is required',
          HTTP_STATUS.BAD_REQUEST
        );
      }
      
      // Only allow updating own location in batch (for apps that send multiple location points)
      const validLocations = locations.filter(loc => 
        loc.user_id === req.userId && 
        loc.latitude && 
        loc.longitude
      );
      
      if (validLocations.length === 0) {
        return errorResponse(
          res,
          'No valid locations provided',
          'No valid location updates found',
          HTTP_STATUS.BAD_REQUEST
        );
      }
      
      // Process the most recent location only
      const latestLocation = validLocations[validLocations.length - 1];
      
      const location = await LocationService.updateUserLocation(
        req.userId,
        latestLocation.latitude,
        latestLocation.longitude,
        latestLocation.heading
      );
      
      successResponse(
        res,
        'Batch location update processed',
        { 
          processed_count: 1,
          latest_location: location
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Batch location update error:', error);
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