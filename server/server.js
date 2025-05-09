// Import required packages
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const initializeRoles = require('./config/initializeRoles');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/social-listening')
  .then(async () => {
    console.log('MongoDB Connected');
    
    try {
      // Force re-initialize roles and update existing users
      const initializeRoles = require('./config/initializeRoles');
      await initializeRoles(true); // Pass true to force update
      console.log('Role initialization completed');
    } catch (error) {
      console.error('Error during role initialization:', error);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Route Imports
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Server Error',
    error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Server configuration
const port = process.env.PORT || 5003;

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 