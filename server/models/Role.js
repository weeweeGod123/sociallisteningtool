const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: { 
    type: String,
    default: ''
  },
  permissions: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Update the timestamp when document is updated
RoleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create Role model
const Role = mongoose.model('Role', RoleSchema);

// Initialize default roles if they don't exist
async function initializeDefaultRoles() {
  try {
    // Check if Admin role exists
    const adminRole = await Role.findOne({ name: 'Admin' });
    if (!adminRole) {
      // Create Admin role with all permissions
      await new Role({
        name: 'Admin',
        description: 'Administrator with full access to all features',
        permissions: [
          'advancedSearch',
          'dashboard',
          'influencers',
          'themes',
          'engagement',
          'geographical',
          'source',
          'sentiment',
          'seasonal',
          'help',
          'settings'
        ]
      }).save();
      console.log('Default Admin role created');
    }

    // Check if User role exists
    const userRole = await Role.findOne({ name: 'User' });
    if (!userRole) {
      // Create User role with basic permissions
      await new Role({
        name: 'User',
        description: 'Regular user with limited access',
        permissions: [
          'advancedSearch',
          'dashboard',
          'help'
        ]
      }).save();
      console.log('Default User role created');
    }
  } catch (error) {
    console.error('Error initializing default roles:', error);
  }
}

// Call the initialization function
initializeDefaultRoles();

module.exports = Role; 