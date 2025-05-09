// Migration script to update existing users
// Adds the isAdmin flag based on current role
// Usage: node scripts/migrate-users.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// MongoDB URI
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Get User model
const User = require('../models/User');

async function migrateUsers() {
  try {
    console.log('Starting user migration...');
    
    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to update`);
    
    // Update each user
    let updatedCount = 0;
    let adminCount = 0;
    
    for (const user of users) {
      // Set isAdmin based on current role
      if (user.role === 'Admin') {
        user.isAdmin = true;
        adminCount++;
      } else {
        user.isAdmin = false;
      }
      
      // Save changes
      await user.save();
      updatedCount++;
      
      // Log progress
      console.log(`Updated user ${user.email} (${updatedCount}/${users.length})`);
    }
    
    console.log('\nMigration completed successfully!');
    console.log(`Updated ${updatedCount} users`);
    console.log(`Set ${adminCount} users as admins`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run the migration
migrateUsers(); 