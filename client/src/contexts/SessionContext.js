// client/src/contexts/SessionContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const SessionContext = createContext();

const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes

export const SessionProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
    const [expiresAt, setExpiresAt] = useState(localStorage.getItem('expiresAt'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [sessionTimeout, setSessionTimeout] = useState(null);
    const [logoutHandlers, setLogoutHandlers] = useState([]);

    const registerLogoutHandler = (handler) => {
        setLogoutHandlers(prev => [...prev, handler]);
    };

    // Helper function to fetch role permissions
    const fetchRolePermissions = async (roleId) => {
        try {
            if (!roleId) return [];
            
            const roleResponse = await axios.get(`http://localhost:5003/api/roles/${roleId}`);
            return roleResponse.data.permissions || [];
        } catch (error) {
            console.error('Error fetching role permissions:', error);
            return [];
        }
    };

    // Set up axios defaults
    useEffect(() => {
        if (token) 
        {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } 
        else 
        {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

     // Initialize session
    useEffect(() => {
        const initSession = async () => {
            try {
                setLoading(true);
                
                // Check for demo user in localStorage
                const demoUserJson = localStorage.getItem('demoUser');
                if (demoUserJson) {
                    const demoUser = JSON.parse(demoUserJson);
                    console.log('Using demo user for session:', demoUser);
                    
                    // Set the demo user in state
                    setUser(demoUser);
                    setLoading(false);
                    updateActivity();
                    return;
                }
                
                if (!token) 
                {
                    setUser(null);
                    setLoading(false);
                    return;
                }
                
                // Validate token and get user info
                try 
                {
                    console.log('Initializing session with token');
                    const response = await axios.get('http://localhost:5003/api/auth/session');
                    let userData = response.data.user;
                    
                    console.log('User data received from server:', userData);
                    
                    // Check if permissions were received from the server
                    if (userData.permissions && Array.isArray(userData.permissions)) {
                        console.log('Permissions received from server:', userData.permissions);
                        // No need to fetch permissions separately, they're already included
                    } else {
                        console.log('No permissions received from server, using fallbacks');
                        // If server didn't provide permissions, use fallbacks based on role
                        if (userData.roleId) {
                            const permissions = await fetchRolePermissions(userData.roleId);
                            userData = {
                                ...userData,
                                permissions
                            };
                            console.log('Loaded user with permissions from API call:', permissions);
                        } else if (userData.role === 'User') {
                            // Default User role permissions if roleId is missing
                            userData.permissions = ['advancedSearch', 'dashboard', 'help'];
                            console.log('Applied default User permissions');
                        } else if (userData.isAdmin) {
                            // Default Admin permissions if roleId is missing
                            userData.permissions = [
                              'advancedSearch', 'dashboard', 'influencers', 'themes', 
                              'engagement', 'geographical', 'source', 'sentiment', 
                              'seasonal', 'help', 'settings'
                            ];
                            console.log('Applied default Admin permissions');
                        } else {
                            // No role assigned, use empty permissions
                            userData.permissions = [];
                            console.log('No role info found, using empty permissions');
                        }
                    }
                    
                    setUser(userData);
                    updateActivity();
                } 
                catch (error) 
                {
                    console.error('Session validation error:', error);
                    // Token might be expired, try to refresh
                    if (refreshToken) 
                    {
                        await refreshSession();
                    } 
                    else 
                    {
                        // No refresh token, clear session
                        logout();
                    }
                }
            } 
            catch (error) 
            {
                console.error('Session initialization error:', error);
                setError(error.message);
                logout();
            } finally 
            {
                setLoading(false);
            }
        };
        initSession();
    }, []);

    // Set up activity tracking
    useEffect(() => {
        // Track user activity to keep session alive
        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        
        const handleActivity = () => 
        {
            updateActivity();
        };
        
        // Add event listeners
        activityEvents.forEach(event => 
        {
            window.addEventListener(event, handleActivity);
        });
        
        // Clean up event listeners
        return () => {
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, []);

    // Check for session expiry
    useEffect(() => {
        if (!user) return;
        
        // Clear any existing timeout
        if (sessionTimeout) 
        {
            clearTimeout(sessionTimeout);
        }
        
        // Set timeout for session expiry
        const timeout = setTimeout(() => 
        {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity;
            
            if (timeSinceLastActivity >= SESSION_TIMEOUT) 
            {
                // Session expired due to inactivity
                console.log('Session expired due to inactivity');
                logout();
            }
        }, SESSION_TIMEOUT);
        
        setSessionTimeout(timeout);
        
        // Clean up timeout on unmount
        return () => {
        if (sessionTimeout) {
            clearTimeout(sessionTimeout);
        }
        };
    }, [lastActivity, user]);

    // Update last activity time
    const updateActivity = () => {
        setLastActivity(Date.now());
        
        // Periodically ping the server to update activity (every 5 minutes)
        if (user && token && (Date.now() - lastActivity > 5 * 60 * 1000)) 
        {
            axios.get('http://localhost:5003/api/auth/session')
                    .catch(error => {
                    console.error('Error updating activity:', error);
                    });
        }
    };

    // Refresh session with refresh token
    const refreshSession = async () => {
        try 
        {
            console.log('Attempting to refresh session');
            
            if (!refreshToken) {
                console.error('No refresh token available');
                throw new Error('No refresh token available');
            }
            
            console.log('Using refresh token to get new access token');
            const response = await axios.post('http://localhost:5003/api/auth/refresh', { refreshToken });
            
            // Update tokens
            const { token: newToken, refreshToken: newRefreshToken, expiresAt: newExpiresAt } = response.data;
            
            console.log('Session refresh successful, updating tokens');
            
            // Save to state and localStorage
            setToken(newToken);
            setRefreshToken(newRefreshToken);
            setExpiresAt(newExpiresAt);
            
            localStorage.setItem('token', newToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            localStorage.setItem('expiresAt', newExpiresAt);
            
            // Update axios default header
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            
            // Get user info with new token
            console.log('Getting updated user info with new token');
            const userResponse = await axios.get('http://localhost:5003/api/auth/session');
            let userData = userResponse.data.user;
            
            console.log('Received updated user data:', userData);
            
            // Ensure user data has consistent id/ID properties
            if (userData) {
                // Add id alias if not present
                if (userData._id && !userData.id) {
                    userData.id = userData._id.toString();
                    console.log('Added id alias to user data');
                }
                
                // Add _id if not present
                if (userData.id && !userData._id) {
                    userData._id = userData.id;
                    console.log('Added _id alias to user data');
                }
            }
            
            // If user has a roleId, fetch role details including permissions
            if (userData.roleId) {
                const permissions = await fetchRolePermissions(userData.roleId);
                userData = {
                    ...userData,
                    permissions
                };
                console.log('Refreshed user session with permissions:', permissions);
            } else if (userData.role === 'User') {
                // Default User role permissions if roleId is missing
                userData.permissions = ['advancedSearch', 'dashboard', 'help'];
                console.log('Applied default User permissions on refresh');
            } else if (userData.isAdmin) {
                // Default Admin permissions if roleId is missing
                userData.permissions = [
                  'advancedSearch', 'dashboard', 'influencers', 'themes', 
                  'engagement', 'geographical', 'source', 'sentiment', 
                  'seasonal', 'help', 'settings'
                ];
                console.log('Applied default Admin permissions on refresh');
            } else {
                // No role assigned, use empty permissions
                userData.permissions = [];
            }
            
            setUser(userData);
            
            return true;
        } 
        catch (error) 
        {
            console.error('Session refresh error:', error);
            
            // Check if this is a token refresh failure (critical) or a user info fetch failure (non-critical)
            if (error.config?.url?.includes('/auth/refresh')) {
                // Critical error during token refresh - log out
                console.error('Critical error during token refresh - logging out');
                logout();
                return false;
            } else {
                // Non-critical error - likely during /auth/session fetch after profile update
                console.warn('Non-critical session refresh error - keeping current session');
                // Don't log out for non-critical errors like user info fetch failures
                // This prevents logout after profile updates
                return false;
            }
        }
    };

    // Login function
    const login = async (email, password) => {
        try 
        {
            // Get device info
            const deviceInfo = {
                device: navigator.userAgent,
                screenSize: `${window.screen.width}x${window.screen.height}`
            };
            
            const response = await axios.post('http://localhost:5003/api/auth/login', {
                email,
                password,
                deviceInfo
            });
            
            let { token: newToken, refreshToken: newRefreshToken, expiresAt: newExpiresAt, user: userData } = response.data;
            
            console.log('Login successful, user data received:', userData);
            
            // Save tokens to localStorage
            localStorage.setItem('token', newToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            localStorage.setItem('expiresAt', newExpiresAt);
            
            // Set axios default header for next requests
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            
            // Check if permissions were received from the server
            if (userData.permissions && Array.isArray(userData.permissions)) {
                console.log('Permissions received from login response:', userData.permissions);
                // No need to fetch permissions separately, they're already included
            } else {
                console.log('No permissions in login response, using fallbacks');
                // If server didn't provide permissions, use fallbacks based on role
                if (userData.roleId) {
                    const permissions = await fetchRolePermissions(userData.roleId);
                    userData = {
                        ...userData,
                        permissions
                    };
                    console.log('Retrieved permissions for role:', permissions);
                } else if (userData.role === 'User') {
                    // Default User role permissions if roleId is missing
                    userData.permissions = ['advancedSearch', 'dashboard', 'help'];
                    console.log('Applied default User permissions on login');
                } else if (userData.isAdmin) {
                    // Default Admin permissions if roleId is missing
                    userData.permissions = [
                      'advancedSearch', 'dashboard', 'influencers', 'themes', 
                      'engagement', 'geographical', 'source', 'sentiment', 
                      'seasonal', 'help', 'settings'
                    ];
                    console.log('Applied default Admin permissions on login');
                } else {
                    // No role assigned, use empty permissions
                    userData.permissions = [];
                    console.log('No role information found, using empty permissions');
                }
            }
            
            // Update state
            setToken(newToken);
            setRefreshToken(newRefreshToken);
            setExpiresAt(newExpiresAt);
            setUser(userData);
            updateActivity();
            
            return { success: true, user: userData };
        } 
        catch (error) 
        {
            console.error('Login error:', error);
            setError(error.response?.data?.message || error.message);
            return { success: false, error: error.response?.data?.message || error.message };
        }
    };

     // Modify the logout function to notify all registered handlers
     const logout = async () => {
        try {
            if (token && refreshToken) {
                // Try to logout on the server
                await axios.post('http://localhost:5003/api/auth/logout', { refreshToken })
                .catch(error => console.error('Logout error:', error));
            }
        } finally {
            // Clear tokens regardless of server response
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('expiresAt');
            
            // Clear demo user data
            localStorage.removeItem('demoUser');
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('userRole');
            
            // Clear state
            setToken(null);
            setRefreshToken(null);
            setExpiresAt(null);
            setUser(null);
            
            // Clear axios default header
            delete axios.defaults.headers.common['Authorization'];
            
            // Clear timeout
            if (sessionTimeout) {
                clearTimeout(sessionTimeout);
                setSessionTimeout(null);
            }
            
            // Notify all registered logout handlers
            logoutHandlers.forEach(handler => {
                try {
                    handler();
                } catch (error) {
                    console.error('Error in logout handler:', error);
                }
            });
        }
    };

    // Get active sessions
    const getActiveSessions = async () => {
        try 
        {
            const response = await axios.get('http://localhost:5003/api/auth/sessions');
            return response.data.sessions;
        } 
        catch (error) 
        {
            console.error('Error fetching active sessions:', error);
            throw error;
        }
    };

    // Terminate a session
    const terminateSession = async (sessionId) => {
        try 
        {
            const response = await axios.delete(`http://localhost:5003/api/auth/sessions/${sessionId}`);
            return response.data;
        } 
        catch (error) 
        {
            console.error('Error terminating session:', error);
            throw error;
        }
    };

    // Check if token is about to expire and refresh if needed
    const checkTokenExpiry = async () => {
        if (!token || !expiresAt || !refreshToken) return;
        
        const expiryTime = new Date(expiresAt);
        const now = new Date();
        
        // Refresh if less than 5 minutes until expiry
        const fiveMinutes = 5 * 60 * 1000;
        if (expiryTime - now < fiveMinutes) 
        {
            await refreshSession();
        }
    };

    // Values provided by context
    const value = {
        user,
        token,
        loading,
        error,
        login,
        registerLogoutHandler,
        logout,
        refreshSession,
        updateActivity,
        getActiveSessions,
        terminateSession,
        checkTokenExpiry,
        isAuthenticated: !!user,
        lastActivity,
        // Add a direct update method to modify user data without triggering a full session refresh
        updateUserDataDirectly: (updatedFields) => {
          if (!user) return false;
          
          try {
            // Create a new user object with the updated fields
            const updatedUser = { ...user, ...updatedFields };
            console.log('Updating user data directly:', updatedFields);
            
            // Update the user state without going through refresh
            setUser(updatedUser);
            
            // Ping activity but don't do a full refresh
            updateActivity();
            
            return true;
          } catch (error) {
            console.error('Error updating user data directly:', error);
            return false;
          }
        },
        // Add demoLogin function for authenticated demo access
        demoLogin: async () => {
            try {
                console.log('Demo login initiated');
                
                // Create a demo user
                const demoUser = {
                    _id: "demo_user_id",
                    name: "Demo Admin",
                    email: "demo@example.com",
                    role: "Admin",
                    roleId: "admin_role_id",
                    isAdmin: true,
                    permissions: [
                        'advancedSearch', 'dashboard', 'influencers', 'themes', 
                        'engagement', 'geographical', 'source', 'sentiment', 
                        'seasonal', 'help', 'settings', 'admin', 'roleManagement'
                    ],
                    lastActive: new Date().toISOString()
                };
                
                // Generate a demo token that will be recognized by the backend
                // In a real implementation, this would be a server API call
                // For demo mode, we'll create a special token format
                const demoToken = `demo_${Date.now()}`;
                
                // Save the demoUser object to localStorage
                localStorage.setItem('demoUser', JSON.stringify(demoUser));
                
                // Set the token in axios headers for API requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${demoToken}`;
                
                // Save tokens to localStorage
                localStorage.setItem('token', demoToken);
                localStorage.setItem('refreshToken', `refresh_${demoToken}`);
                localStorage.setItem('expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
                
                // Set user in state
                setToken(demoToken);
                setUser(demoUser);
                updateActivity();
                
                console.log('Demo login successful, token set:', demoToken);
                
                return { success: true, user: demoUser };
            } catch (error) {
                console.error('Demo login error:', error);
                return { success: false, error: error.message };
            }
        }
    };

    return (
        <SessionContext.Provider value={value}>
        {children}
        </SessionContext.Provider>
    );
};

// Custom hook to use the session context
export const useSession = () => {
    const context = useContext(SessionContext);
    if (context === undefined) 
    {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};

export default SessionContext;
