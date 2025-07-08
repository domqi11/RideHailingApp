const { verifyToken } = require('../utils/helpers');
const { SOCKET_EVENTS, SOCKET_ROOMS, USER_ROLES } = require('../utils/constants');
const { LocationService, RideService } = require('./databaseService');

// Store connected users and their socket IDs
const connectedUsers = new Map(); // userId -> { socketId, role, isOnline }
const userSockets = new Map(); // socketId -> userId

/**
 * Initialize WebSocket handlers
 */
const initializeWebSocket = (io) => {
  console.log('🔌 Initializing WebSocket service...');

  io.use(async (socket, next) => {
    try {
      // Extract token from connection query or headers
      const token = socket.handshake.auth.token || 
                   socket.handshake.query.token ||
                   socket.request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = verifyToken(token);
      
      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;

      console.log(`🔐 WebSocket authentication successful for user: ${decoded.email}`);
      next();
    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error.message);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    console.log(`✅ User connected: ${socket.userEmail} (${socket.id})`);

    // Store user connection
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      role: socket.userRole,
      isOnline: true,
      connectedAt: new Date().toISOString()
    });
    userSockets.set(socket.id, socket.userId);

    // Join user-specific room
    socket.join(SOCKET_ROOMS.USER(socket.userId));

    // Join role-specific room
    if (socket.userRole === USER_ROLES.DRIVER || socket.userRole === USER_ROLES.BOTH) {
      socket.join(SOCKET_ROOMS.DRIVERS);
      console.log(`🚗 Driver ${socket.userEmail} joined drivers room`);
    }
    
    if (socket.userRole === USER_ROLES.CUSTOMER || socket.userRole === USER_ROLES.BOTH) {
      socket.join(SOCKET_ROOMS.CUSTOMERS);
      console.log(`👤 Customer ${socket.userEmail} joined customers room`);
    }

    // Send connection confirmation
    socket.emit('connected', {
      success: true,
      message: 'WebSocket connection established',
      userId: socket.userId,
      rooms: Array.from(socket.rooms),
      timestamp: new Date().toISOString()
    });

    // Handle join specific room (e.g., ride room)
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data) => {
      handleJoinRoom(socket, data);
    });

    // Handle leave room
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data) => {
      handleLeaveRoom(socket, data);
    });

    // Handle location updates (drivers and customers)
    socket.on(SOCKET_EVENTS.LOCATION_UPDATE, (data) => {
      handleLocationUpdate(socket, data, io);
    });

    // Handle ride updates
    socket.on(SOCKET_EVENTS.RIDE_UPDATE, (data) => {
      handleRideUpdate(socket, data, io);
    });

    // Handle ride requests (from customers)
    socket.on(SOCKET_EVENTS.RIDE_REQUEST, (data) => {
      handleRideRequest(socket, data, io);
    });

    // Handle ride acceptance (from drivers)
    socket.on(SOCKET_EVENTS.RIDE_ACCEPTED, (data) => {
      handleRideAccepted(socket, data, io);
    });

    // Handle ride cancellation
    socket.on(SOCKET_EVENTS.RIDE_CANCELLED, (data) => {
      handleRideCancelled(socket, data, io);
    });

    // Handle generic messaging
    socket.on('message', (data) => {
      handleMessage(socket, data, io);
    });

    // Handle disconnection
    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ WebSocket error for user ${socket.userEmail}:`, error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'WebSocket error occurred',
        timestamp: new Date().toISOString()
      });
    });
  });

  // Set up periodic cleanup
  setInterval(() => {
    cleanupInactiveConnections(io);
  }, 60000); // Every minute

  console.log('✅ WebSocket service initialized successfully');
};

/**
 * Handle joining a room
 */
const handleJoinRoom = (socket, data) => {
  try {
    const { roomId, roomType } = data;

    if (!roomId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Room ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate room access based on user role and room type
    const canJoinRoom = validateRoomAccess(socket, roomId, roomType);
    
    if (!canJoinRoom) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Unauthorized to join this room',
        timestamp: new Date().toISOString()
      });
      return;
    }

    socket.join(roomId);
    console.log(`📍 User ${socket.userEmail} joined room: ${roomId}`);

    socket.emit('room-joined', {
      success: true,
      roomId,
      roomType,
      message: `Successfully joined ${roomType || 'room'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error joining room:', error);
    socket.emit(SOCKET_EVENTS.ERROR, {
      success: false,
      error: 'Failed to join room',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle leaving a room
 */
const handleLeaveRoom = (socket, data) => {
  try {
    const { roomId } = data;

    if (!roomId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Room ID is required'
      });
      return;
    }

    socket.leave(roomId);
    console.log(`🚪 User ${socket.userEmail} left room: ${roomId}`);

    socket.emit('room-left', {
      success: true,
      roomId,
      message: 'Successfully left room',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error leaving room:', error);
  }
};

/**
 * Handle location updates
 */
const handleLocationUpdate = async (socket, data, io) => {
  try {
    const { latitude, longitude, heading } = data;

    if (!latitude || !longitude) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Latitude and longitude are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Update location in database
    await LocationService.updateUserLocation(socket.userId, latitude, longitude, heading);

    const locationUpdate = {
      userId: socket.userId,
      latitude,
      longitude,
      heading,
      timestamp: new Date().toISOString()
    };

    // Broadcast to relevant rooms based on user role
    if (socket.userRole === USER_ROLES.DRIVER || socket.userRole === USER_ROLES.BOTH) {
      // Broadcast driver location to customers in nearby area
      socket.to(SOCKET_ROOMS.CUSTOMERS).emit(SOCKET_EVENTS.DRIVER_LOCATION, locationUpdate);
    }

    // Always send to user's own room for personal tracking
    io.to(SOCKET_ROOMS.USER(socket.userId)).emit(SOCKET_EVENTS.LOCATION_UPDATE, locationUpdate);

    // Acknowledge successful update
    socket.emit('location-updated', {
      success: true,
      message: 'Location updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating location:', error);
    socket.emit(SOCKET_EVENTS.ERROR, {
      success: false,
      error: 'Failed to update location',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle ride updates
 */
const handleRideUpdate = async (socket, data, io) => {
  try {
    const { rideId, status, message, location } = data;

    if (!rideId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Ride ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Get ride details to validate user access
    const ride = await RideService.getRideById(rideId);
    
    if (!ride) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Ride not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate user is part of this ride
    if (socket.userId !== ride.customer_id && socket.userId !== ride.driver_id) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Unauthorized to update this ride',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const rideUpdateData = {
      rideId,
      status,
      message,
      location,
      updatedBy: socket.userId,
      timestamp: new Date().toISOString()
    };

    // Broadcast to ride room
    io.to(SOCKET_ROOMS.RIDE(rideId)).emit(SOCKET_EVENTS.RIDE_UPDATE, rideUpdateData);

    // Also send to both customer and driver directly
    if (ride.customer_id) {
      io.to(SOCKET_ROOMS.USER(ride.customer_id)).emit(SOCKET_EVENTS.RIDE_UPDATE, rideUpdateData);
    }
    if (ride.driver_id) {
      io.to(SOCKET_ROOMS.USER(ride.driver_id)).emit(SOCKET_EVENTS.RIDE_UPDATE, rideUpdateData);
    }

    console.log(`🚗 Ride update sent for ride ${rideId}: ${status}`);

  } catch (error) {
    console.error('❌ Error handling ride update:', error);
    socket.emit(SOCKET_EVENTS.ERROR, {
      success: false,
      error: 'Failed to update ride',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle ride requests from customers
 */
const handleRideRequest = async (socket, data, io) => {
  try {
    const { pickupLocation, destination, estimatedFare } = data;

    if (!pickupLocation || !destination) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Pickup location and destination are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Only customers can request rides
    if (socket.userRole !== USER_ROLES.CUSTOMER && socket.userRole !== USER_ROLES.BOTH) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Only customers can request rides',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const rideRequestData = {
      customerId: socket.userId,
      pickupLocation,
      destination,
      estimatedFare,
      requestId: `req_${Date.now()}_${socket.userId}`,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all available drivers
    socket.to(SOCKET_ROOMS.DRIVERS).emit(SOCKET_EVENTS.RIDE_REQUEST, rideRequestData);

    // Acknowledge to customer
    socket.emit('ride-request-sent', {
      success: true,
      message: 'Ride request sent to nearby drivers',
      requestId: rideRequestData.requestId,
      timestamp: new Date().toISOString()
    });

    console.log(`🎯 Ride request from customer ${socket.userEmail} broadcasted to drivers`);

  } catch (error) {
    console.error('❌ Error handling ride request:', error);
    socket.emit(SOCKET_EVENTS.ERROR, {
      success: false,
      error: 'Failed to send ride request',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle ride acceptance from drivers
 */
const handleRideAccepted = async (socket, data, io) => {
  try {
    const { rideId, customerId, estimatedArrival } = data;

    if (!rideId || !customerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Ride ID and customer ID are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Only drivers can accept rides
    if (socket.userRole !== USER_ROLES.DRIVER && socket.userRole !== USER_ROLES.BOTH) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Only drivers can accept rides',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const acceptanceData = {
      rideId,
      driverId: socket.userId,
      customerId,
      estimatedArrival,
      message: 'Your ride has been accepted!',
      timestamp: new Date().toISOString()
    };

    // Notify customer
    io.to(SOCKET_ROOMS.USER(customerId)).emit(SOCKET_EVENTS.RIDE_ACCEPTED, acceptanceData);

    // Create ride room for ongoing communication
    socket.join(SOCKET_ROOMS.RIDE(rideId));
    
    // Add customer to ride room if they're connected
    const customerConnection = connectedUsers.get(customerId);
    if (customerConnection) {
      io.sockets.sockets.get(customerConnection.socketId)?.join(SOCKET_ROOMS.RIDE(rideId));
    }

    console.log(`✅ Ride ${rideId} accepted by driver ${socket.userEmail}`);

  } catch (error) {
    console.error('❌ Error handling ride acceptance:', error);
    socket.emit(SOCKET_EVENTS.ERROR, {
      success: false,
      error: 'Failed to accept ride',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle ride cancellation
 */
const handleRideCancelled = async (socket, data, io) => {
  try {
    const { rideId, reason } = data;

    if (!rideId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Ride ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const cancellationData = {
      rideId,
      cancelledBy: socket.userId,
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString()
    };

    // Broadcast to ride room
    io.to(SOCKET_ROOMS.RIDE(rideId)).emit(SOCKET_EVENTS.RIDE_CANCELLED, cancellationData);

    console.log(`❌ Ride ${rideId} cancelled by ${socket.userEmail}`);

  } catch (error) {
    console.error('❌ Error handling ride cancellation:', error);
  }
};

/**
 * Handle generic messages
 */
const handleMessage = (socket, data, io) => {
  try {
    const { to, message, type = 'text' } = data;

    if (!to || !message) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        success: false,
        error: 'Recipient and message are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const messageData = {
      from: socket.userId,
      fromEmail: socket.userEmail,
      to,
      message,
      type,
      timestamp: new Date().toISOString()
    };

    // Send to specific user
    io.to(SOCKET_ROOMS.USER(to)).emit('message', messageData);

    // Acknowledge to sender
    socket.emit('message-sent', {
      success: true,
      message: 'Message sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
};

/**
 * Handle user disconnection
 */
const handleDisconnection = (socket, reason) => {
  console.log(`❌ User disconnected: ${socket.userEmail} (${socket.id}) - Reason: ${reason}`);

  // Update user status
  if (connectedUsers.has(socket.userId)) {
    const userInfo = connectedUsers.get(socket.userId);
    userInfo.isOnline = false;
    userInfo.disconnectedAt = new Date().toISOString();
  }

  // Clean up mappings
  userSockets.delete(socket.id);

  // Optional: Remove from connected users after a delay (for reconnection handling)
  setTimeout(() => {
    if (connectedUsers.has(socket.userId)) {
      const userInfo = connectedUsers.get(socket.userId);
      if (!userInfo.isOnline) {
        connectedUsers.delete(socket.userId);
      }
    }
  }, 30000); // 30 seconds grace period for reconnection
};

/**
 * Validate room access based on user role and room type
 */
const validateRoomAccess = (socket, roomId, roomType) => {
  // Basic validation - can be expanded based on business logic
  
  if (roomType === 'ride') {
    // Users can only join ride rooms they're part of
    // This would require checking the database to verify the user is customer or driver
    return true; // Simplified for now
  }

  if (roomType === 'driver' && (socket.userRole === USER_ROLES.DRIVER || socket.userRole === USER_ROLES.BOTH)) {
    return true;
  }

  if (roomType === 'customer' && (socket.userRole === USER_ROLES.CUSTOMER || socket.userRole === USER_ROLES.BOTH)) {
    return true;
  }

  return false;
};

/**
 * Clean up inactive connections
 */
const cleanupInactiveConnections = (io) => {
  const now = new Date();
  const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

  for (const [userId, userInfo] of connectedUsers.entries()) {
    if (!userInfo.isOnline) {
      const disconnectedTime = new Date(userInfo.disconnectedAt || userInfo.connectedAt);
      if (now - disconnectedTime > inactiveThreshold) {
        connectedUsers.delete(userId);
        console.log(`🧹 Cleaned up inactive connection for user: ${userId}`);
      }
    }
  }
};

/**
 * Get connected users count
 */
const getConnectedUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Get connected users by role
 */
const getConnectedUsersByRole = (role) => {
  const users = [];
  for (const [userId, userInfo] of connectedUsers.entries()) {
    if (userInfo.role === role && userInfo.isOnline) {
      users.push({ userId, ...userInfo });
    }
  }
  return users;
};

/**
 * Send message to specific user
 */
const sendToUser = (io, userId, event, data) => {
  io.to(SOCKET_ROOMS.USER(userId)).emit(event, data);
};

/**
 * Send message to all drivers
 */
const sendToAllDrivers = (io, event, data) => {
  io.to(SOCKET_ROOMS.DRIVERS).emit(event, data);
};

/**
 * Send message to all customers
 */
const sendToAllCustomers = (io, event, data) => {
  io.to(SOCKET_ROOMS.CUSTOMERS).emit(event, data);
};

module.exports = {
  initializeWebSocket,
  getConnectedUsersCount,
  getConnectedUsersByRole,
  sendToUser,
  sendToAllDrivers,
  sendToAllCustomers,
  connectedUsers,
  userSockets
}; 