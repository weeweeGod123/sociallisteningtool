const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Role = require("../models/Role");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SessionService = require("../services/sessionService");
const { validateSession } = require("../config/auth_middleware");

// Helper function to get user data with permissions
const getUserWithPermissions = async (user) => {
  try {
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      isAdmin: user.isAdmin,
      lastActive: user.lastActive
    };

    console.log(`Getting permissions for user ${user.name} (${user.email})`);
    console.log(`User role: ${user.role}, roleId: ${user.roleId}, isAdmin: ${user.isAdmin}`);

    // If user has a roleId, fetch permissions from database
    if (user.roleId) {
      try {
        const role = await Role.findById(user.roleId);
        if (role) {
          console.log(`Found role in database: ${role.name} with permissions:`, role.permissions);
          userData.permissions = role.permissions;
        } else {
          console.log(`Role with ID ${user.roleId} not found in database, using fallback permissions`);
          // Role not found but should exist - use fallback permissions
          userData.permissions = user.isAdmin ? 
            ['advancedSearch', 'dashboard', 'influencers', 'themes', 'engagement', 
            'geographical', 'source', 'sentiment', 'seasonal', 'help', 'settings'] : 
            ['advancedSearch', 'dashboard', 'help'];
        }
      } catch (roleError) {
        console.error(`Error fetching role with ID ${user.roleId}:`, roleError);
        // Use fallback permissions if role fetch fails
        userData.permissions = user.isAdmin ? 
          ['advancedSearch', 'dashboard', 'influencers', 'themes', 'engagement', 
          'geographical', 'source', 'sentiment', 'seasonal', 'help', 'settings'] : 
          ['advancedSearch', 'dashboard', 'help'];
      }
    } 
    // If no roleId but has a role name, try to find role by name
    else if (user.role) {
      try {
        const role = await Role.findOne({ name: user.role });
        if (role) {
          console.log(`Found role by name: ${role.name} with permissions:`, role.permissions);
          // Update user with roleId for future reference
          user.roleId = role._id;
          await user.save();
          console.log(`Updated user ${user.email} with roleId ${role._id}`);
          userData.permissions = role.permissions;
        } else {
          console.log(`Role with name "${user.role}" not found, using fallback permissions`);
          // Role name not found, use fallback based on admin status
          userData.permissions = user.isAdmin || user.role === 'Admin' ? 
            ['advancedSearch', 'dashboard', 'influencers', 'themes', 'engagement', 
            'geographical', 'source', 'sentiment', 'seasonal', 'help', 'settings'] : 
            ['advancedSearch', 'dashboard', 'help'];
        }
      } catch (roleError) {
        console.error(`Error finding role by name "${user.role}":`, roleError);
        userData.permissions = user.isAdmin || user.role === 'Admin' ? 
          ['advancedSearch', 'dashboard', 'influencers', 'themes', 'engagement', 
          'geographical', 'source', 'sentiment', 'seasonal', 'help', 'settings'] : 
          ['advancedSearch', 'dashboard', 'help'];
      }
    } else {
      console.log(`User has no role information, using fallback permissions based on admin status`);
      // No role assigned at all, use fallback based on admin status
      userData.permissions = user.isAdmin ? 
        ['advancedSearch', 'dashboard', 'influencers', 'themes', 'engagement',
         'geographical', 'source', 'sentiment', 'seasonal', 'help', 'settings'] : 
        ['advancedSearch', 'dashboard', 'help'];
    }

    console.log(`Final permissions for ${user.name}:`, userData.permissions);
    return userData;
  } catch (error) {
    console.error("Error getting user with permissions:", error);
    // Fallback in case of error
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      isAdmin: user.isAdmin,
      permissions: user.isAdmin ? 
        ['advancedSearch', 'dashboard', 'influencers', 'themes', 'engagement', 
         'geographical', 'source', 'sentiment', 'seasonal', 'help', 'settings'] : 
        ['advancedSearch', 'dashboard', 'help']
    };
  }
};

// Login Endpoint: POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password, deviceInfo } = req.body;  // Extract deviceInfo if provided
  console.log("🛂 Login attempt:", email); // Log the email

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found.");
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log("❌ Invalid password.");
      return res.status(400).json({ message: "Invalid credentials" });
    }
    
    // Create session tokens
    const sessionInfo = SessionService.createSession(user);

    // Use deviceInfo if provided, otherwise fall back to headers
    const deviceName = deviceInfo?.device || req.headers["user-agent"] || 'unknown';
    const ipAddress = req.ip || 'unknown';
    
    // Use the manageSession method which will update existing tokens or create new ones
    await user.manageSession(sessionInfo, deviceName, ipAddress);
    
    // Update last login time
    user.lastLogin = new Date();
    user.lastActive = new Date();
    await user.save();

    // Get user data with permissions
    const userData = await getUserWithPermissions(user);

    console.log("✅ Login success:", user.email);

    // Return the session information with permissions
    res.status(200).json({
      message: "Login successful!",
      token: sessionInfo.token,
      refreshToken: sessionInfo.refreshToken,
      expiresAt: sessionInfo.expiresAt,
      user: userData
    });
  } 
  catch (error) 
  {
    console.error("🚨 Login error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Registration Endpoint: POST /auth/register
router.post("/register", async (req, res) => {
  console.log("🔐 Incoming register request:", req.body); // Log incoming data

  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Create new user - password hashing is moved into the User model
    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ 
      message: "User registered successfully!",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isAdmin: newUser.isAdmin
      }
    });
  } catch (error) {
    console.error("🚨 Registration error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Forgot Password Endpoint: POST /auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found" });

    // In production, you'd send an email with a reset token
    console.log(`📩 Send password reset to: ${email}`);
    
    res.status(200).json({ message: "Reset instructions sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ message: "Server error." });
  }
});

// Refresh Token Endpoint: POST /auth/refresh
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) 
  {
    return res.status(400).json({ message: "Refresh token is required" });
  }
  
  try 
  {
    // Attempt to refresh the session
    const sessionInfo = await SessionService.refreshSession(refreshToken);
    
    if (!sessionInfo) 
    {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    
    // Find the user to get their data
    const user = await User.findById(sessionInfo.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Get user data with permissions
    const userData = await getUserWithPermissions(user);
    
    // Return new tokens with user data
    res.status(200).json({
      message: "Session refreshed successfully",
      token: sessionInfo.token,
      refreshToken: sessionInfo.refreshToken,
      expiresAt: sessionInfo.expiresAt,
      user: userData
    });
  } 
  catch (error) 
  {
    console.error("🚨 Token refresh error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Logout Endpoint: POST /auth/logout
router.post("/logout", validateSession, async (req, res) => {
  const { refreshToken } = req.body;
  
  try 
  {
    // Remove session from user's active sessions
    if (refreshToken) 
    {
      await req.user.removeSession(refreshToken);
    }
    
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("🚨 Logout error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get Session Status: GET /auth/session
router.get("/session", validateSession, async (req, res) => {
  try 
  {
    // Update last activity time
    await req.user.updateActivity();
    
    // Get user data with permissions
    const userData = await getUserWithPermissions(req.user);
    
    res.status(200).json({
      user: userData
    });
  } 
  catch (error) 
  {
    console.error("🚨 Session error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get Active Sessions: GET /auth/sessions
router.get("/sessions", validateSession, async (req, res) => {
  try 
  {
    // Filter out expired sessions
    const now = new Date();
    const activeSessions = req.user.activeSessions
      .filter(session => new Date(session.expiresAt) > now)
      .map(session => ({
        id: session._id,
        device: session.device,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt
      }));
    
    res.status(200).json({ sessions: activeSessions });
  } 
  catch (error) 
  {
    console.error("🚨 Active sessions error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Terminate Session: DELETE /auth/sessions/:sessionId
router.delete("/sessions/:sessionId", validateSession, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Find and remove the session
    req.user.activeSessions = req.user.activeSessions.filter(
      session => session._id.toString() !== sessionId
    );
    
    await req.user.save();
    
    res.status(200).json({ message: "Session terminated successfully" });
  } 
  catch (error) 
  {
    console.error("🚨 Session termination error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete own account: DELETE /auth/delete-account
router.delete("/delete-account", validateSession, async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`User ${req.user.email} (${userId}) has requested account deletion`);
    
    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log(`User account ${req.user.email} (${userId}) has been successfully deleted`);
    
    res.status(200).json({
      message: "Your account has been permanently deleted",
      success: true
    });
  } 
  catch (error) 
  {
    console.error("🚨 Account deletion error:", error.message);
    res.status(500).json({ 
      message: "Server error during account deletion", 
      error: error.message 
    });
  }
});

// Also support POST method for compatibility
router.post("/delete-account", validateSession, async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`User ${req.user.email} (${userId}) has requested account deletion via POST`);
    
    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log(`User account ${req.user.email} (${userId}) has been successfully deleted`);
    
    res.status(200).json({
      message: "Your account has been permanently deleted",
      success: true
    });
  } 
  catch (error) 
  {
    console.error("🚨 Account deletion error:", error.message);
    res.status(500).json({ 
      message: "Server error during account deletion", 
      error: error.message 
    });
  }
});

module.exports = router;