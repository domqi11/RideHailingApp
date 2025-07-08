const express = require('express');
const { authenticate, checkOwnership } = require('../middleware/auth');
const { validateUser, validateCommon } = require('../middleware/validation');
const { UserService } = require('../services/databaseService');
const { successResponse, errorResponse, sanitizeUser, asyncHandler } = require('../utils/helpers');
const { HTTP_STATUS, MESSAGES } = require('../utils/constants');

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  try {
    const user = await UserService.findById(req.userId);
    
    if (!user) {
      return errorResponse(
        res,
        MESSAGES.ERROR.USER_NOT_FOUND,
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    successResponse(
      res,
      'Profile retrieved successfully',
      { user: sanitizeUser(user) },
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
}));

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', 
  authenticate, 
  validateUser.updateProfile, 
  asyncHandler(async (req, res) => {
    try {
      const updateData = req.body;
      
      const updatedUser = await UserService.updateProfile(req.userId, updateData);
      
      successResponse(
        res,
        MESSAGES.SUCCESS.PROFILE_UPDATED,
        { user: sanitizeUser(updatedUser) },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Update profile error:', error);
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
 * @route   DELETE /api/users/profile
 * @desc    Deactivate user account
 * @access  Private
 */
router.delete('/profile', authenticate, asyncHandler(async (req, res) => {
  try {
    await UserService.deactivateUser(req.userId);
    
    successResponse(
      res,
      'Account deactivated successfully',
      { message: 'Your account has been deactivated. Contact support to reactivate.' },
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('Deactivate account error:', error);
    errorResponse(
      res,
      MESSAGES.ERROR.INTERNAL_SERVER_ERROR,
      error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}));

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID (for other users to see basic info)
 * @access  Private
 */
router.get('/:userId', 
  authenticate,
  validateUser.userId,
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await UserService.findById(userId);
      
      if (!user) {
        return errorResponse(
          res,
          MESSAGES.ERROR.USER_NOT_FOUND,
          'User not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      // Return only basic public information
      const publicUserInfo = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture_url: user.profile_picture_url
      };

      successResponse(
        res,
        'User info retrieved successfully',
        { user: publicUserInfo },
        HTTP_STATUS.OK
      );
    } catch (error) {
      console.error('Get user by ID error:', error);
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