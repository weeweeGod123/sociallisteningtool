const Role = require('../models/Role');
const User = require('../models/User');

/**
 * Function to initialize default roles on server start
 * @param {boolean} forceUpdate - If true, will update all users regardless of whether they have roleId
 */
async function initializeRoles(forceUpdate = false) {
  try {
    console.log('Checking for default roles...');
    
    // Define the default roles - Admin is not a role, it's a status
    const defaultRoles = [
      {
        name: 'User',
        description: 'Standard user with basic access',
        permissions: [
          'advancedSearch',
          'dashboard',
          'help',
          'influencers',
          'themes',
          'engagement',
          'geographical',
          'source',
          'sentiment',
          'seasonal',
          'settings'
        ]
      },
      {
        name: 'Analyst',
        description: 'User focused on data analysis',
        permissions: [
          'advancedSearch',
          'dashboard',
          'geographical',
          'source',
          'sentiment',
          'seasonal',
          'help'
        ]
      },
      {
        name: 'Content Manager',
        description: 'User focused on content management',
        permissions: [
          'advancedSearch',
          'dashboard',
          'influencers',
          'themes',
          'engagement',
          'help'
        ]
      }
    ];
    
    // Create each role if it doesn't exist
    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (!existingRole) {
        await new Role(roleData).save();
        console.log(`Created default role: ${roleData.name}`);
      } else {
        // Update permissions if they've changed
        if (JSON.stringify(existingRole.permissions.sort()) !== JSON.stringify(roleData.permissions.sort())) {
          existingRole.permissions = roleData.permissions;
          await existingRole.save();
          console.log(`Updated permissions for role: ${roleData.name}`);
        } else {
          console.log(`Default role already exists: ${roleData.name}`);
        }
      }
    }
    
    // Remove the Admin role if it exists (since Admin is a status, not a role)
    const adminRoleExists = await Role.findOne({ name: 'Admin' });
    if (adminRoleExists) {
      console.log('Removing "Admin" role (admin is now a status, not a role)');
      await Role.deleteOne({ name: 'Admin' });
    }
    
    // Fetch User role after creating/updating
    const userRole = await Role.findOne({ name: 'User' });
    
    if (userRole) {
      // Query condition depends on forceUpdate parameter
      const query = forceUpdate ? {} : {
        $or: [
          { roleId: { $exists: false } },
          { roleId: null }
        ]
      };
      
      // Find all users that need role assignment
      const usersToUpdate = await User.find(query);
      
      console.log(`Found ${usersToUpdate.length} users to update${forceUpdate ? ' (force update)' : ''}`);
      
      for (const user of usersToUpdate) {
        // All users get assigned the User role by default, regardless of admin status
        // isAdmin flag controls admin privileges separately from role
        user.roleId = userRole._id;
        user.role = 'User';
        
        // Log updates with admin status for clarity
        const adminStatus = user.isAdmin ? ' (with admin status)' : '';
        console.log(`Updated user ${user.email || user._id} with User role ID${adminStatus}`);
        
        await user.save();
      }
    }
    
    console.log('Role initialization complete');
  } catch (error) {
    console.error('Error initializing roles:', error);
  }
}

module.exports = initializeRoles; 