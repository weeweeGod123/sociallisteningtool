const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const { validateSession } = require('../config/auth_middleware');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Unauthorized: Admin access required' });
  }
  next();
};

// Get all roles
router.get('/', validateSession, async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json(roles);
  } catch (err) {
    console.error('Error fetching roles:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// Get role by ID
router.get('/:id', validateSession, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json(role);
  } catch (err) {
    console.error('Error fetching role:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// Create a new role (admin only)
router.post('/', validateSession, isAdmin, async (req, res) => {
  const { name, permissions } = req.body;

  // Validate role data
  if (!name) {
    return res.status(400).json({ message: 'Role name is required' });
  }

  try {
    // Check if role with same name already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({ message: 'Role with this name already exists' });
    }

    // Create the new role
    const newRole = new Role({
      name,
      permissions: permissions || []
    });

    const savedRole = await newRole.save();
    res.status(201).json(savedRole);
  } catch (err) {
    console.error('Error creating role:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// Update a role (admin only)
router.put('/:id', validateSession, isAdmin, async (req, res) => {
  const { name, permissions } = req.body;

  // Validate role data
  if (!name) {
    return res.status(400).json({ message: 'Role name is required' });
  }

  try {
    // Check if updating to a name that already exists (except for this role)
    const existingRole = await Role.findOne({ name, _id: { $ne: req.params.id } });
    if (existingRole) {
      return res.status(400).json({ message: 'Role with this name already exists' });
    }

    // Find and update the role
    const updatedRole = await Role.findByIdAndUpdate(
      req.params.id,
      {
        name,
        permissions: permissions || [],
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updatedRole) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json(updatedRole);
  } catch (err) {
    console.error('Error updating role:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// Delete a role (admin only)
router.delete('/:id', validateSession, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    await Role.findByIdAndDelete(req.params.id);
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    console.error('Error deleting role:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

module.exports = router; 