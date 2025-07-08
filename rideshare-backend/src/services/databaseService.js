const { supabaseAdmin } = require('../../config/database');
const { calculateDistance, generateUUID, formatDate } = require('../utils/helpers');
const { TABLES, RIDE_STATUS, USER_ROLES, GEO_CONSTANTS } = require('../utils/constants');

/**
 * Database service for user operations
 */
class UserService {
  /**
   * Create a new user
   */
  static async createUser(userData) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USERS)
      .insert(userData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return data;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USERS)
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data;
  }

  /**
   * Find user by ID
   */
  static async findById(userId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USERS)
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updateData) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USERS)
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data;
  }

  /**
   * Deactivate user (soft delete)
   */
  static async deactivateUser(userId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USERS)
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deactivate user: ${error.message}`);
    }

    return data;
  }
}

/**
 * Database service for driver operations
 */
class DriverService {
  /**
   * Create driver profile
   */
  static async createProfile(userId, profileData) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.DRIVER_PROFILES)
      .insert({
        user_id: userId,
        ...profileData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create driver profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Get driver profile by user ID
   */
  static async getProfileByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.DRIVER_PROFILES)
      .select(`
        *,
        users:user_id (
          id,
          first_name,
          last_name,
          email,
          phone,
          profile_picture_url
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get driver profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Update driver profile
   */
  static async updateProfile(userId, updateData) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.DRIVER_PROFILES)
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update driver profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Update driver availability
   */
  static async updateAvailability(userId, isAvailable) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.DRIVER_PROFILES)
      .update({ is_available: isAvailable })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update driver availability: ${error.message}`);
    }

    return data;
  }

  /**
   * Find available drivers near location
   */
  static async findNearbyAvailableDrivers(latitude, longitude, radiusKm = 5, limit = 20) {
    try {
      // Get all available drivers with their locations
      const { data: drivers, error } = await supabaseAdmin
        .from(TABLES.DRIVER_PROFILES)
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            phone
          ),
          user_locations!inner (
            latitude,
            longitude,
            updated_at
          )
        `)
        .eq('is_available', true)
        .limit(100); // Get more than needed, then filter by distance

      if (error) {
        throw new Error(`Failed to find nearby drivers: ${error.message}`);
      }

      if (!drivers || drivers.length === 0) {
        return [];
      }

      // Calculate distances and filter by radius
      const driversWithDistance = drivers
        .map(driver => {
          if (!driver.user_locations || driver.user_locations.length === 0) {
            return null;
          }

          const location = driver.user_locations[0];
          const distance = calculateDistance(
            latitude,
            longitude,
            location.latitude,
            location.longitude
          );

          return {
            ...driver,
            distance,
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
              updated_at: location.updated_at
            }
          };
        })
        .filter(driver => driver && driver.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      return driversWithDistance;
    } catch (error) {
      console.error('Error finding nearby drivers:', error);
      throw error;
    }
  }

  /**
   * Update driver rating after completed ride
   */
  static async updateRating(userId, newRating, totalRides) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.DRIVER_PROFILES)
      .update({
        rating: newRating,
        total_rides: totalRides
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update driver rating: ${error.message}`);
    }

    return data;
  }
}

/**
 * Database service for ride operations
 */
class RideService {
  /**
   * Create a new ride request
   */
  static async createRide(rideData) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDES)
      .insert(rideData)
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create ride: ${error.message}`);
    }

    return data;
  }

  /**
   * Get ride by ID with full details
   */
  static async getRideById(rideId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDES)
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name,
          phone,
          profile_picture_url
        ),
        driver:driver_id (
          id,
          first_name,
          last_name,
          phone,
          profile_picture_url
        )
      `)
      .eq('id', rideId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get ride: ${error.message}`);
    }

    return data;
  }

  /**
   * Update ride status
   */
  static async updateRideStatus(rideId, status, updateData = {}) {
    const updateObject = {
      status,
      ...updateData
    };

    if (status === RIDE_STATUS.COMPLETED) {
      updateObject.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDES)
      .update(updateObject)
      .eq('id', rideId)
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name,
          phone
        ),
        driver:driver_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update ride status: ${error.message}`);
    }

    return data;
  }

  /**
   * Assign driver to ride
   */
  static async assignDriver(rideId, driverId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDES)
      .update({
        driver_id: driverId,
        status: RIDE_STATUS.ACCEPTED
      })
      .eq('id', rideId)
      .eq('status', RIDE_STATUS.PENDING) // Only assign if still pending
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name,
          phone
        ),
        driver:driver_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to assign driver: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user's ride history
   */
  static async getUserRideHistory(userId, page = 1, limit = 20, filters = {}) {
    let query = supabaseAdmin
      .from(TABLES.RIDES)
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name
        ),
        driver:driver_id (
          id,
          first_name,
          last_name,
          driver_profiles (
            rating,
            vehicle_make,
            vehicle_model
          )
        )
      `, { count: 'exact' });

    // Filter by user (either as customer or driver)
    query = query.or(`customer_id.eq.${userId},driver_id.eq.${userId}`);

    // Apply additional filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.from_date) {
      query = query.gte('created_at', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false })
                 .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get ride history: ${error.message}`);
    }

    return {
      rides: data || [],
      total: count || 0
    };
  }

  /**
   * Get pending rides for drivers in area
   */
  static async getPendingRidesInArea(latitude, longitude, radiusKm = 10, limit = 20) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDES)
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq('status', RIDE_STATUS.PENDING)
      .order('created_at', { ascending: true })
      .limit(100); // Get more than needed, then filter by distance

    if (error) {
      throw new Error(`Failed to get pending rides: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter rides by distance from driver location
    const nearbyRides = data
      .map(ride => {
        const pickupLocation = ride.pickup_location;
        if (!pickupLocation || !pickupLocation.latitude || !pickupLocation.longitude) {
          return null;
        }

        const distance = calculateDistance(
          latitude,
          longitude,
          pickupLocation.latitude,
          pickupLocation.longitude
        );

        return {
          ...ride,
          distance_to_pickup: distance
        };
      })
      .filter(ride => ride && ride.distance_to_pickup <= radiusKm)
      .sort((a, b) => a.distance_to_pickup - b.distance_to_pickup)
      .slice(0, limit);

    return nearbyRides;
  }

  /**
   * Cancel ride
   */
  static async cancelRide(rideId, cancelledBy, reason) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDES)
      .update({
        status: RIDE_STATUS.CANCELLED,
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
        completed_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .neq('status', RIDE_STATUS.COMPLETED) // Can't cancel completed rides
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel ride: ${error.message}`);
    }

    return data;
  }
}

/**
 * Database service for location operations
 */
class LocationService {
  /**
   * Update user location
   */
  static async updateUserLocation(userId, latitude, longitude, heading = null) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USER_LOCATIONS)
      .upsert({
        user_id: userId,
        latitude,
        longitude,
        heading,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update location: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user's current location
   */
  static async getUserLocation(userId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USER_LOCATIONS)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get user location: ${error.message}`);
    }

    return data;
  }

  /**
   * Get multiple users' locations
   */
  static async getMultipleUserLocations(userIds) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.USER_LOCATIONS)
      .select('*')
      .in('user_id', userIds);

    if (error) {
      throw new Error(`Failed to get user locations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete user location
   */
  static async deleteUserLocation(userId) {
    const { error } = await supabaseAdmin
      .from(TABLES.USER_LOCATIONS)
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete user location: ${error.message}`);
    }

    return true;
  }

  /**
   * Clean up old location data
   */
  static async cleanupOldLocations(olderThanHours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

    const { error } = await supabaseAdmin
      .from(TABLES.USER_LOCATIONS)
      .delete()
      .lt('updated_at', cutoffTime.toISOString());

    if (error) {
      console.error('Failed to cleanup old locations:', error);
    }

    return true;
  }
}

/**
 * Database service for ride requests
 */
class RideRequestService {
  /**
   * Create ride request for matching
   */
  static async createRideRequest(customerId, pickupLocation, destination) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDE_REQUESTS)
      .insert({
        customer_id: customerId,
        pickup_location: pickupLocation,
        destination,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ride request: ${error.message}`);
    }

    return data;
  }

  /**
   * Get active ride requests in area
   */
  static async getActiveRequestsInArea(latitude, longitude, radiusKm = 10) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDE_REQUESTS)
      .select(`
        *,
        customer:customer_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get ride requests: ${error.message}`);
    }

    // Filter by distance (similar to rides)
    if (!data || data.length === 0) {
      return [];
    }

    const nearbyRequests = data
      .map(request => {
        const pickupLocation = request.pickup_location;
        if (!pickupLocation || !pickupLocation.latitude || !pickupLocation.longitude) {
          return null;
        }

        const distance = calculateDistance(
          latitude,
          longitude,
          pickupLocation.latitude,
          pickupLocation.longitude
        );

        return {
          ...request,
          distance_to_pickup: distance
        };
      })
      .filter(request => request && request.distance_to_pickup <= radiusKm)
      .sort((a, b) => a.distance_to_pickup - b.distance_to_pickup);

    return nearbyRequests;
  }

  /**
   * Mark ride request as accepted
   */
  static async acceptRideRequest(requestId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.RIDE_REQUESTS)
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to accept ride request: ${error.message}`);
    }

    return data;
  }

  /**
   * Clean up expired requests
   */
  static async cleanupExpiredRequests() {
    const { error } = await supabaseAdmin
      .from(TABLES.RIDE_REQUESTS)
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Failed to cleanup expired requests:', error);
    }

    return true;
  }
}

module.exports = {
  UserService,
  DriverService,
  RideService,
  LocationService,
  RideRequestService
}; 