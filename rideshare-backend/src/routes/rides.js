const express = require('express');
const { authenticate, customerOnly, driverOnly, checkRideAccess, requireDriverProfile } = require('../middleware/auth');
const { validateRide, validateCommon, customValidations } = require('../middleware/validation');
const { RideService, DriverService } = require('../services/databaseService');
const { successResponse, errorResponse, asyncHandler, calculateDistance, calculateFare, estimateDuration } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES, RIDE_STATUS } = require('../utils/constants');

const router = express.Router();

/**
 * @route   POST /api/rides/request
 * @desc    Request a ride (customers only)
 * @access  Private (Customer)
 */
router.post('/request',
  authenticate,
  customerOnly,
  validateRide.requestRide,
  customValidations.validateAustralianCoordinates,
  asyncHandler(async (req, res) => {
    try {
      const { pickup_location, destination, stops, estimated_fare, notes } = req.body;
      
      // Calculate distance and fare
      const distance = calculateDistance(
        pickup_location.latitude,
        pickup_location.longitude,
        destination.latitude,
        destination.longitude
      );
      
      const calculatedFare = calculateFare(distance);
      const estimatedDuration = estimateDuration(distance);
      
      const rideData = {
        customer_id: req.userId,
        pickup_location,
        destination,
        stops: stops || null,
        fare: estimated_fare || calculatedFare,
        distance_km: distance,
        estimated_duration: estimatedDuration,
        status: RIDE_STATUS.PENDING,
        notes: notes || null
      };
      
      const ride = await RideService.createRide(rideData);
      
      // Emit ride request to nearby drivers via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to('drivers').emit('ride-request', {
          rideId: ride.id,
          customerId: req.userId,
          pickupLocation: pickup_location,
          destination,
          fare: calculatedFare,
          distance: distance,
          estimatedDuration
        });
      }
      
      successResponse(
        res,
        MESSAGES.SUCCESS.RIDE_REQUESTED,
        { 
          ride,
          calculated_values: {
            distance_km: distance,
            estimated_fare: calculatedFare,
            estimated_duration: estimatedDuration
          }
        },
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      console.error('Request ride error:', error);
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
 * @route   POST /api/rides/:id/accept
 * @desc    Accept a ride (drivers only)
 * @access  Private (Driver with profile)
 */
router.post('/:id/accept',
  authenticate,
  requireDriverProfile,
  validateCommon.id,
  asyncHandler(async (req, res) => {
    try {
      const rideId = req.params.id;
      
      const ride = await RideService.assignDriver(rideId, req.userId);
      
      if (!ride) {
        return errorResponse(
          res,
          MESSAGES.ERROR.RIDE_ALREADY_ACCEPTED,
          'This ride has already been accepted or is no longer available',
          HTTP_STATUS.CONFLICT
        );
      }
      
      // Update driver availability to false
      await DriverService.updateAvailability(req.userId, false);
      
      // Emit ride acceptance via WebSocket
      const io = req.app.get('io');
      if (io) {
        // Notify customer
        io.to(`user_${ride.customer_id}`).emit('ride-accepted', {
          rideId: ride.id,
          driver: {
            id: req.userId,
            name: `${req.user.first_name} ${req.user.last_name}`,
            phone: req.user.phone,
            rating: req.driverProfile.rating,
            vehicle: {
              make: req.driverProfile.vehicle_make,
              model: req.driverProfile.vehicle_model,
              year: req.driverProfile.vehicle_year,
              plate: req.driverProfile.vehicle_plate
            }
          }
        });
        
        // Create ride room for ongoing communication
        io.emit('join-room', { roomId: `ride_${rideId}` });
      }
      
      successResponse(
        res,
        MESSAGES.SUCCESS.RIDE_ACCEPTED,
        { ride },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Accept ride error:', error);
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
 * @route   PUT /api/rides/:id/status
 * @desc    Update ride status
 * @access  Private (Ride participant)
 */
router.put('/:id/status',
  authenticate,
  checkRideAccess,
  validateRide.updateStatus,
  customValidations.validateStatusTransition,
  asyncHandler(async (req, res) => {
    try {
      const rideId = req.params.id;
      const { status, notes } = req.body;
      
      const updateData = notes ? { notes } : {};
      const updatedRide = await RideService.updateRideStatus(rideId, status, updateData);
      
      // Handle status-specific logic
      if (status === RIDE_STATUS.COMPLETED) {
        // Make driver available again
        if (updatedRide.driver_id) {
          await DriverService.updateAvailability(updatedRide.driver_id, true);
        }
      }
      
      // Emit status update via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to(`ride_${rideId}`).emit('ride-update', {
          rideId,
          status,
          updatedBy: req.userId,
          timestamp: new Date().toISOString(),
          ride: updatedRide
        });
      }
      
      successResponse(
        res,
        `Ride status updated to ${status}`,
        { ride: updatedRide },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Update ride status error:', error);
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
 * @route   GET /api/rides/history
 * @desc    Get user's ride history
 * @access  Private
 */
router.get('/history',
  authenticate,
  validateRide.history,
  asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 20, status, from_date, to_date } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      
      const result = await RideService.getUserRideHistory(
        req.userId, 
        parseInt(page), 
        parseInt(limit), 
        filters
      );
      
      successResponse(
        res,
        'Ride history retrieved successfully',
        {
          rides: result.rides,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          }
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get ride history error:', error);
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
 * @route   DELETE /api/rides/:id/cancel
 * @desc    Cancel a ride
 * @access  Private (Ride participant)
 */
router.delete('/:id/cancel',
  authenticate,
  checkRideAccess,
  asyncHandler(async (req, res) => {
    try {
      const rideId = req.params.id;
      const { reason } = req.body;
      
      const cancelledRide = await RideService.cancelRide(rideId, req.userId, reason);
      
      // Make driver available again if they were assigned
      if (cancelledRide.driver_id) {
        await DriverService.updateAvailability(cancelledRide.driver_id, true);
      }
      
      // Emit cancellation via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to(`ride_${rideId}`).emit('ride-cancelled', {
          rideId,
          cancelledBy: req.userId,
          reason: reason || 'No reason provided',
          timestamp: new Date().toISOString()
        });
      }
      
      successResponse(
        res,
        MESSAGES.SUCCESS.RIDE_CANCELLED,
        { ride: cancelledRide },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Cancel ride error:', error);
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
 * @route   GET /api/rides/nearby
 * @desc    Get nearby pending rides (for drivers)
 * @access  Private (Driver with profile)
 */
router.get('/nearby',
  authenticate,
  requireDriverProfile,
  validateRide.history, // Reuse pagination validation
  asyncHandler(async (req, res) => {
    try {
      const { latitude, longitude, radius = 10, limit = 20 } = req.query;
      
      if (!latitude || !longitude) {
        return errorResponse(
          res,
          'Latitude and longitude are required',
          'Please provide your current location',
          HTTP_STATUS.BAD_REQUEST
        );
      }
      
      const nearbyRides = await RideService.getPendingRidesInArea(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        parseInt(limit)
      );
      
      successResponse(
        res,
        'Nearby rides retrieved successfully',
        { 
          rides: nearbyRides,
          count: nearbyRides.length,
          search_params: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            radius: parseFloat(radius)
          }
        },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get nearby rides error:', error);
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
 * @route   GET /api/rides/:id
 * @desc    Get ride details
 * @access  Private (Ride participant)
 */
router.get('/:id',
  authenticate,
  checkRideAccess,
  validateCommon.id,
  asyncHandler(async (req, res) => {
    try {
      const rideId = req.params.id;
      const ride = await RideService.getRideById(rideId);
      
      if (!ride) {
        return errorResponse(
          res,
          MESSAGES.ERROR.RIDE_NOT_FOUND,
          'Ride not found',
          HTTP_STATUS.NOT_FOUND
        );
      }
      
      successResponse(
        res,
        'Ride details retrieved successfully',
        { ride },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get ride details error:', error);
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