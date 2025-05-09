// sessionService.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Session configuration
const SESSION_SECRET = process.env.JWT_SECRET;
const SESSION_EXPIRY = process.env.SESSION_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '1d';

/**
 * Service to handle user session management
 */
class SessionService 
{
    /**
     * Create a new session token for a user
     * @param {Object} user - User object from database
     * @returns {Object} - Session token information
     */
    static createSession(user) 
    {
        // Create main session token
        console.log('Creating session for user:', user.email);
        console.log('Session secret:', SESSION_SECRET);
        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email,
                name: user.name 
            }, 
            SESSION_SECRET, 
            { expiresIn: SESSION_EXPIRY }
        );
        
        // Create refresh token with longer expiry
        const refreshToken = jwt.sign(
            { userId: user._id },
            SESSION_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRY }
        );
        
        // Calculate expiry times for client use
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + parseInt(SESSION_EXPIRY));
        
        const refreshExpiry = new Date();
        refreshExpiry.setDate(refreshExpiry.getDate() + parseInt(REFRESH_TOKEN_EXPIRY));
        
        return {
            token,
            refreshToken,
            expiresAt: tokenExpiry,
            refreshExpiresAt: refreshExpiry
        };
    }
    
    /**
     * Check if a user has existing sessions with the same device
     * @param {string} userId - User ID
     * @param {string} deviceInfo - Device information
     * @returns {Object|null} - Existing session or null
     */
    static async checkExistingSession(userId, deviceInfo) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return null;
            }
            
            // Find if user has an active session with the same device
            const existingSession = user.activeSessions.find(
                session => session.device === deviceInfo
            );
            
            return existingSession || null;
        } catch (error) {
            console.error('Error checking existing session:', error.message);
            return null;
        }
    }
    
    /**
     * Validate a session token
     * @param {string} token - JWT token to validate
     * @returns {Object|null} - Decoded token payload or null if invalid
     */
    static validateToken(token) 
    {
        try
        {
            // Check for demo token pattern (demo_timestamp)
            if (token.startsWith('demo_')) {
                console.log('Validating demo token:', token);
                // For demo tokens, create a synthetic decoded payload
                return {
                    userId: 'demo_user_id',
                    email: 'demo@example.com',
                    name: 'Demo Admin',
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
                };
            }
            
            // Regular token validation
            const decoded = jwt.verify(token, SESSION_SECRET);
            return decoded;
        } 
        catch (error) 
        {
            console.error('Token validation error:', error.message);
            return null;
        }
    }
    
    /**
     * Refresh a session using a refresh token
     * @param {string} refreshToken - Refresh token
     * @returns {Object|null} - New session information or null if invalid
     */
    static async refreshSession(refreshToken) 
    {
        try 
        {
            // Verify the refresh token
            const decoded = jwt.verify(refreshToken, SESSION_SECRET);
            
            // Get the user from database
            const user = await User.findById(decoded.userId);
            if (!user) 
            {
                return null;
            }
            
            // Check if the refresh token exists in user's active sessions
            const sessionExists = user.activeSessions.some(
                session => session.token === refreshToken
            );
            
            if (!sessionExists) {
                console.warn('Refresh token not found in active sessions');
                return null;
            }
            
            // Create a new session
            return this.createSession(user);
        } 
        catch (error) 
        {
            console.error('Session refresh error:', error.message);
            return null;
        }
    }
    
    /**
     * Invalidate a user's session (for logout)
     * @param {string} userId - User ID
     * @param {string} refreshToken - Refresh token to invalidate
     * @returns {boolean} - Success status
     */
    static async invalidateSession(userId, refreshToken) 
    {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return false;
            }
            
            // Remove the session with the given refresh token
            await user.removeSession(refreshToken);
            return true;
        } catch (error) {
            console.error('Session invalidation error:', error.message);
            return false;
        }
    }
    
    /**
     * Clean up expired sessions for a user
     * @param {string} userId - User ID
     * @returns {boolean} - Success status
     */
    static async cleanupExpiredSessions(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return false;
            }
            
            const now = new Date();
            const initialCount = user.activeSessions.length;
            
            // Filter out expired sessions
            user.activeSessions = user.activeSessions.filter(
                session => new Date(session.expiresAt) > now
            );
            
            // Only save if there were expired sessions
            if (initialCount !== user.activeSessions.length) {
                await user.save();
                console.log(`Cleaned up ${initialCount - user.activeSessions.length} expired sessions for user ${userId}`);
            }
            
            return true;
        } catch (error) {
            console.error('Session cleanup error:', error.message);
            return false;
        }
    }
}

module.exports = SessionService;