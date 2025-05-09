// middleware/authMiddleware.js
const User = require('../models/User');
const SessionService = require('../services/sessionService');
const mongoose = require('mongoose');

/**
 * Middleware to validate session and attach user to request
 */
const validateSession = async (req, res, next) => {
    try 
    {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) 
      {
        return res.status(401).json({ message: "No token provided" });
      }
      
      console.log('Validating token:', token.substring(0, 10) + '...');
      
      const decoded = SessionService.validateToken(token);
      if (!decoded) 
      {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      // Check if this is a demo token
      if (token.startsWith('demo_')) {
        console.log('Creating demo user for request');
        // Create a synthetic demo user
        req.user = {
          _id: 'demo_user_id',
          id: 'demo_user_id', // Add 'id' alias for compatibility
          name: 'Demo Admin',
          email: 'demo@example.com',
          role: 'Admin',
          roleId: 'admin_role_id',
          isAdmin: true,
          lastActive: new Date(),
          // Add a dummy save method for middleware that might call it
          save: async () => Promise.resolve()
        };
        return next();
      }
      
      const user = await User.findById(decoded.userId);
      if (!user) 
      {
        console.log(`User not found for ID: ${decoded.userId}`);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update lastActive time with each authenticated request
      user.lastActive = new Date();
      await user.save();
      
      // Add id alias for _id to ensure consistency
      user.id = user._id.toString();
      
      // Add a helper method to compare IDs safely
      user.isSameUser = function(userId) {
        if (!userId) return false;
        
        // Convert to string for comparison
        const thisId = (this._id || this.id || '').toString();
        const otherId = userId.toString();
        
        return thisId === otherId;
      };
      
      req.user = user;
      next();
    } 
    catch (error) 
    {
      console.error("Session validation error:", error.message);
      console.error(error.stack);
      res.status(500).json({ message: "Server error", error: error.message });
    }
};

/**
 * Middleware to check if user has required role
 * @param {string|string[]} roles - Required role(s)
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    // First validate session
    validateSession(req, res, () => 
    {
      // Admin users have access to everything
      if (req.user.isAdmin) {
        return next();
      }
      
      // Check if user has required role
      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!allowedRoles.includes(userRole)) 
      {
        return res.status(403).json({ 
          message: 'Access denied: insufficient permissions'
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware to update user's last activity time
 */
const trackActivity = async (req, res, next) => {
  try {
    // Skip tracking for non-authenticated routes
    if (!req.user)
    {
      return next();
    }
    
    // Update last activity time
    req.user.lastActive = new Date();
    await req.user.save();
    
    next();
  } 
  catch (error) 
  {
    // Just log the error but don't stop the request
    console.error('Activity tracking error:', error.message);
    next();
  }
};

module.exports = {
  validateSession,
  requireRole,
  trackActivity
};