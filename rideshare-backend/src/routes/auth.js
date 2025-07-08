const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  changePassword,
  refreshToken,
  verifyToken
} = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validateAuth, validateUser } = require('../middleware/validation');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (customer or driver)
 * @access  Public
 * @body    { email, password, first_name, last_name, phone?, role? }
 */
router.post('/register', validateAuth.register, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', validateAuth.login, login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token client-side)
 * @access  Private
 */
router.post('/logout', optionalAuth, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { current_password, new_password }
 */
router.post('/change-password', 
  authenticate, 
  validateUser.changePassword, 
  changePassword
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh-token', authenticate, refreshToken);

/**
 * @route   GET /api/auth/verify-token
 * @desc    Verify if token is valid
 * @access  Private
 */
router.get('/verify-token', authenticate, verifyToken);

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status (optional auth)
 * @access  Public/Private
 */
router.get('/status', optionalAuth, (req, res) => {
  const user = req.user;
  
  res.json({
    success: true,
    authenticated: !!user,
    user: user || null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 