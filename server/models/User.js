// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'User' },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  // Profile fields
  bio: { type: String, default: '' },
  organization: { type: String, default: '' },
  location: { type: String, default: '' },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  isAdmin: { type: Boolean, default: false },
  lastLogin: { type: Date },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  activeSessions: [{ token: String, expiresAt: Date, device: String, ip: String, lastActivity: Date }]
}, 
{ 
  timestamps: true 
});

// Using password salting and hashing
UserSchema.pre('save', async function(next) 
{
  if (!this.isModified('password')) 
  {
    return next();
  }
  
  try 
  {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) 
{
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update last activity
UserSchema.methods.updateActivity = async function() 
{
  this.lastActive = new Date();
  return this.save();
};

// Method to manage sessions (update or create)
UserSchema.methods.manageSession = async function(sessionInfo, device = 'unknown', ip = 'unknown') {
  // Find if there are any existing sessions with the same device
  const existingSessionIndex = this.activeSessions.findIndex(
    session => session.device === device
  );
  
  if (existingSessionIndex !== -1) {
    // Update existing session
    this.activeSessions[existingSessionIndex] = {
      token: sessionInfo.refreshToken,
      expiresAt: sessionInfo.refreshExpiresAt,
      device,
      ip,
      lastActivity: new Date()
    };
  } else {
    // Enforce session limit (10 active sessions)
    if (this.activeSessions.length >= 10) {
      // Remove the oldest session based on last activity
      this.activeSessions.sort((a, b) => a.lastActivity - b.lastActivity);
      this.activeSessions.shift();
    }
    
    // Add new session
    this.activeSessions.push({
      token: sessionInfo.refreshToken,
      expiresAt: sessionInfo.refreshExpiresAt,
      device,
      ip,
      lastActivity: new Date()
    });
  }
  
  return this.save();
};

// Method to add a new session (keeping for backward compatibility)
UserSchema.methods.addSession = async function(sessionInfo, device = 'unknown', ip = 'unknown') 
{
  // Call the new manageSession method instead
  return this.manageSession(sessionInfo, device, ip);
};

// Method to remove a session
UserSchema.methods.removeSession = async function(token) 
{
  this.activeSessions = this.activeSessions.filter(session => session.token !== token);
  return this.save();
};

// Method to check if user is an admin
UserSchema.methods.isUserAdmin = function() {
  return this.isAdmin === true;
};

// Method to compare password for login
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);