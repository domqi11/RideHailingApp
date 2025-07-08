const {
  hashPassword,
  comparePassword,
  generateToken,
  successResponse,
  errorResponse,
  sanitizeUser,
  asyncHandler,
  isValidEmail,
  isValidPassword
} = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES, USER_ROLES } = require('../utils/constants');
const { UserService } = require('../services/databaseService');

/**
 * Register a new user (customer or driver)
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, phone, role = USER_ROLES.CUSTOMER } = req.body;

  try {
    // Check if user already exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return errorResponse(
        res,
        MESSAGES.ERROR.EMAIL_ALREADY_EXISTS,
        'A user with this email already exists',
        HTTP_STATUS.CONFLICT
      );
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user data
    const userData = {
      email: email.toLowerCase().trim(),
      password_hash,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone?.trim() || null,
      role,
      is_active: true
    };

    // Create user in database
    const newUser = await UserService.createUser(userData);
    
    // Generate JWT token
    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    // Return success response with user data and token
    const responseData = {
      user: sanitizeUser(newUser),
      token,
      message: `${role === USER_ROLES.DRIVER ? 'Driver' : 'Customer'} account created successfully`
    };

    successResponse(
      res,
      MESSAGES.SUCCESS.USER_REGISTERED,
      responseData,
      HTTP_STATUS.CREATED
    );

  } catch (error) {
    console.error('Registration error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await UserService.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return errorResponse(
        res,
        MESSAGES.ERROR.INVALID_CREDENTIALS,
        'Invalid email or password',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return errorResponse(
        res,
        MESSAGES.ERROR.UNAUTHORIZED,
        'Account has been deactivated. Please contact support.',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse(
        res,
        MESSAGES.ERROR.INVALID_CREDENTIALS,
        'Invalid email or password',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Update last login time
    await UserService.updateProfile(user.id, {
      last_login: new Date().toISOString()
    });

    // Return success response
    const responseData = {
      user: sanitizeUser(user),
      token,
      message: `Welcome back, ${user.first_name}!`
    };

    successResponse(
      res,
      MESSAGES.SUCCESS.USER_LOGIN,
      responseData,
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Login error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Logout user (client-side token removal + optional server-side token blacklisting)
 */
const logout = asyncHandler(async (req, res) => {
  try {
    // In a JWT system, logout is primarily handled client-side by removing the token
    // For enhanced security, you could implement token blacklisting here
    
    // Optional: Log logout activity
    if (req.user) {
      console.log(`User ${req.user.email} logged out at ${new Date().toISOString()}`);
    }

    successResponse(
      res,
      MESSAGES.SUCCESS.USER_LOGOUT,
      { message: 'Successfully logged out. Please remove the token from client storage.' },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Logout error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Get current user profile
 */
const getMe = asyncHandler(async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    const user = req.user;
    
    if (!user) {
      return errorResponse(
        res,
        MESSAGES.ERROR.USER_NOT_FOUND,
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Get fresh user data from database to ensure accuracy
    const freshUser = await UserService.findById(user.id);
    
    if (!freshUser) {
      return errorResponse(
        res,
        MESSAGES.ERROR.USER_NOT_FOUND,
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // If user is a driver, include driver profile information
    let driverProfile = null;
    if (freshUser.role === USER_ROLES.DRIVER || freshUser.role === USER_ROLES.BOTH) {
      try {
        const { DriverService } = require('../services/databaseService');
        driverProfile = await DriverService.getProfileByUserId(freshUser.id);
      } catch (error) {
        console.log('No driver profile found for user:', freshUser.id);
      }
    }

    const responseData = {
      user: sanitizeUser(freshUser),
      driver_profile: driverProfile,
      permissions: {
        can_request_rides: [USER_ROLES.CUSTOMER, USER_ROLES.BOTH].includes(freshUser.role),
        can_accept_rides: [USER_ROLES.DRIVER, USER_ROLES.BOTH].includes(freshUser.role),
        has_driver_profile: !!driverProfile
      }
    };

    successResponse(
      res,
      'Profile retrieved successfully',
      responseData,
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get profile error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Change user password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.userId;

  try {
    // Get current user with password hash
    const user = await UserService.findById(userId);
    if (!user) {
      return errorResponse(
        res,
        MESSAGES.ERROR.USER_NOT_FOUND,
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return errorResponse(
        res,
        MESSAGES.ERROR.INVALID_CREDENTIALS,
        'Current password is incorrect',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Check if new password is different from current
    const isSamePassword = await comparePassword(new_password, user.password_hash);
    if (isSamePassword) {
      return errorResponse(
        res,
        MESSAGES.ERROR.VALIDATION_ERROR,
        'New password must be different from current password',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Hash new password
    const new_password_hash = await hashPassword(new_password);

    // Update password in database
    await UserService.updateProfile(userId, {
      password_hash: new_password_hash,
      password_changed_at: new Date().toISOString()
    });

    successResponse(
      res,
      'Password changed successfully',
      { message: 'Your password has been updated. Please login again with your new password.' },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Change password error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Refresh JWT token
 */
const refreshToken = asyncHandler(async (req, res) => {
  try {
    // User is already authenticated via middleware
    const user = req.user;

    // Generate new token
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    successResponse(
      res,
      'Token refreshed successfully',
      { 
        token: newToken,
        user: sanitizeUser(user),
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Token refresh error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Verify token endpoint (for client-side token validation)
 */
const verifyToken = asyncHandler(async (req, res) => {
  try {
    // If we reach here, the token is valid (verified by auth middleware)
    const user = req.user;

    successResponse(
      res,
      'Token is valid',
      { 
        valid: true,
        user: sanitizeUser(user),
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Token verification error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INVALID_TOKEN,
      'Invalid token',
      HTTP_STATUS.UNAUTHORIZED
    );
  }
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  changePassword,
  refreshToken,
  verifyToken
}; 