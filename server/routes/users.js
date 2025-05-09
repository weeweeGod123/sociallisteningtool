const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Role = require("../models/Role");
const { validateSession } = require("../config/auth_middleware");
const bcrypt = require("bcryptjs");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Unauthorized: Admin access required" });
  }
  next();
};

// Get all users (excluding passwords)
router.get("/", validateSession, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password -activeSessions");
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Get user by ID (excluding password)
router.get("/:id", validateSession, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`Get user profile request for ID: ${userId}`);
    
    const user = await User.findById(userId).select("-password -activeSessions");
    if (!user) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(404).json({ msg: "User not found" });
    }
    
    // Users can only view their own profile unless they are an admin
    if (!req.user.isSameUser(userId) && !req.user.isAdmin) {
      console.log('Unauthorized profile view attempt', { requestUser: req.user.id, targetUser: userId });
      return res.status(403).json({ message: "Unauthorized to view this user" });
    }
    
    console.log(`User profile found and returned: ${userId}`);
    res.json(user);
  } catch (err) {
    console.error(err.message);
    console.error(err.stack);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "User not found" });
    }
    res.status(500).send("Server Error");
  }
});

// Update user role or admin status
router.patch("/:id/role", validateSession, isAdmin, async (req, res) => {
  try {
    const { role, isAdmin, roleId } = req.body;
    const userId = req.params.id;

    // Find the user to update
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update role name if provided
    if (role !== undefined) {
      userToUpdate.role = role;
    }

    // Update isAdmin if provided
    if (isAdmin !== undefined) {
      userToUpdate.isAdmin = isAdmin;
    }
    
    // Update roleId if provided
    if (roleId !== undefined) {
      // If roleId is provided, verify it exists and update both roleId and role name
      if (roleId) {
        const selectedRole = await Role.findById(roleId);
        if (!selectedRole) {
          return res.status(404).json({ message: "Role not found" });
        }
        userToUpdate.roleId = roleId;
        userToUpdate.role = selectedRole.name;
      } else {
        // If roleId is empty, clear the role assignment
        userToUpdate.roleId = null;
        userToUpdate.role = "User"; // Default role
      }
    }

    await userToUpdate.save();

    res.json({
      message: "User updated successfully",
      user: {
        id: userToUpdate._id,
        name: userToUpdate.name,
        email: userToUpdate.email,
        role: userToUpdate.role,
        roleId: userToUpdate.roleId,
        isAdmin: userToUpdate.isAdmin
      }
    });
  } catch (err) {
    console.error("Error updating user:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// Delete a user (admin only)
router.delete('/:id', validateSession, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting their own account
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      userId: deletedUser._id
    });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// Update user profile information
router.patch("/:id/profile", validateSession, async (req, res) => {
  try {
    const { name, email, bio, organization, location } = req.body;
    const userId = req.params.id;
    
    console.log(`Profile update request for user ID: ${userId}`, req.body);
    console.log(`Request user: ${req.user.id} (${req.user._id})`);
    console.log(`Is same user check: ${req.user.isSameUser(userId)}`);
    console.log(`User admin status: ${req.user.isAdmin}`);

    // Users can only update their own profile unless they are an admin
    if (!req.user.isSameUser(userId) && !req.user.isAdmin) {
      console.log('Unauthorized update attempt', { requestUser: req.user.id, targetUser: userId });
      return res.status(403).json({ message: "Unauthorized to update this user" });
    }

    // Find the user to update
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    console.log('Found user to update:', {
      id: userToUpdate._id,
      name: userToUpdate.name,
      email: userToUpdate.email
    });

    // Update fields if provided
    if (name !== undefined) userToUpdate.name = name;
    if (email !== undefined) userToUpdate.email = email;
    
    // Update optional profile fields (can be empty strings)
    if (bio !== undefined) userToUpdate.bio = bio;
    if (organization !== undefined) userToUpdate.organization = organization;
    if (location !== undefined) userToUpdate.location = location;

    console.log(`Saving updated user: ${userId}`, {
      name: userToUpdate.name,
      email: userToUpdate.email,
      bio: userToUpdate.bio,
      organization: userToUpdate.organization,
      location: userToUpdate.location
    });

    await userToUpdate.save();

    // Make sure to return user object with both _id and id for client compatibility
    const userData = userToUpdate.toObject();
    userData.id = userData._id.toString();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: userData.id,
        _id: userData._id,
        name: userData.name,
        email: userData.email,
        bio: userData.bio,
        organization: userData.organization,
        location: userData.location,
        role: userData.role,
        isAdmin: userData.isAdmin
      }
    });
  } catch (err) {
    console.error("Error updating profile:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// Update user password
router.patch("/:id/password", validateSession, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.params.id;
    
    console.log(`Password update request for user ID: ${userId}`);

    // Users can only change their own password
    if (!req.user.isSameUser(userId)) {
      console.log('Unauthorized password change attempt', { requestUser: req.user.id, targetUser: userId });
      return res.status(403).json({ message: "Unauthorized to change this user's password" });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      console.log(`Incorrect current password for user: ${userId}`);
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save();
    console.log(`Password updated successfully for user: ${userId}`);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error updating password:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

module.exports = router;
