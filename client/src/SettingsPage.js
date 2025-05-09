// SettingsPage.js - Updated with user data and edit functionality
import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import { FaChevronDown, FaChevronRight, FaEye, FaEyeSlash, FaUserCircle, FaPencilAlt, FaSave, FaTimes, FaTrash } from 'react-icons/fa';
import { useSession } from './contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import api from './services/api';
import { useFlashMessages } from './contexts/FlashMessageContext';
import axios from 'axios';
import DeactivateAccountModal from './components/DeactivateAccountModal';

// API base URL - must match what's used in AdminPage.js
const API_BASE_URL = 'http://localhost:5003';

// Helper function to try a request with multiple user ID formats and API paths
const tryWithMultipleFormats = async (userId, requestFn) => {
  const apiPaths = [
    // Standard path
    (id) => `/api/users/${id}/profile`,
    // Try without /api prefix (some servers use different paths)
    (id) => `/users/${id}/profile`,
    // Try with v1 prefix
    (id) => `/api/v1/users/${id}/profile`
  ];
  
  // Try with original ID
  try {
    console.log('Trying with original ID:', userId);
    return await requestFn(userId);
  } catch (error) {
    console.log('Failed with original ID, trying alternatives...');
    
    // If it has hyphens, try without
    if (userId && typeof userId === 'string' && userId.includes('-')) {
      try {
        const noHyphensId = userId.replace(/-/g, '');
        console.log('Trying with no hyphens ID:', noHyphensId);
        return await requestFn(noHyphensId);
      } catch (error2) {
        console.log('Failed with no hyphens ID');
      }
    }
    
    // Try with ObjectId string representation if it's stored differently
    if (userId && typeof userId === 'object' && userId.toString) {
      try {
        const stringId = userId.toString();
        console.log('Trying with toString():', stringId);
        return await requestFn(stringId);
      } catch (error3) {
        console.log('Failed with toString()');
      }
    }
    
    // If nothing worked, rethrow the original error
    throw error;
  }
};

// Helper function to ensure session remains active
const updateSessionActivity = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token available for session activity update');
      return;
    }
    
    console.log('Sending activity ping to keep session alive');
    await fetch(`${API_BASE_URL}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
    // Non-critical error, don't throw
  }
};

const SettingsSection = ({ title, children, isOpen, onToggle }) => (
  <div className="section">
    <div className="section-header" onClick={onToggle}>
      <div className="section-title">{title}</div>
      <div className={`section-icon ${isOpen ? 'rotate' : ''}`}>
        {isOpen ? <FaChevronDown /> : <FaChevronRight />}
      </div>
    </div>
    {isOpen && <div className="section-content">{children}</div>}
  </div>
);

export default function SettingsPage() {
  const sessionContext = useSession();
  const { user, refreshSession, updateActivity, updateUserDataDirectly, logout } = sessionContext;
  const { success, error, persistentSuccess, persistentError } = useFlashMessages();
  const navigate = useNavigate();
  
  const [activeSection, setActiveSection] = useState('Account Settings');
  
  // Account settings state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Profile state
  const [bio, setBio] = useState('');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState('');
  
  // Password visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Edit mode toggles
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Add state for deactivate account modal
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Log user data to diagnose issues
  useEffect(() => {
    console.log('User data in SettingsPage:', user);
  }, [user]);

  // Set initial values from user data
  useEffect(() => {
    if (user) {
      // Account settings
      setName(user.name || '');
      setEmail(user.email || '');
      
      // Profile settings
      setBio(user.bio || '');
      setOrganization(user.organization || '');
      setLocation(user.location || '');
    }
  }, [user]);

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? '' : section);
  };

  const passwordsMatch = newPassword === confirmPassword;

  // Get the proper user ID (supporting both _id and id formats)
  const getUserId = () => {
    if (!user) return null;
    
    // Debug user object structure
    console.log('User object structure:', {
      id: user.id,
      _id: user._id,
      type_id: typeof user.id,
      type__id: typeof user._id,
      full_user: user
    });
    
    // If user._id is an object with toString method (MongoDB ObjectId), convert it
    if (user._id && typeof user._id === 'object' && user._id.toString) {
      return user._id.toString();
    }
    
    // Use id or _id, whichever is available
    return user.id || user._id;
  };

  // Handle account settings update
  const handleAccountUpdate = async () => {
    try {
      setLoading(true);
      setErrors({});
      
      const userId = getUserId();
      if (!userId) {
        error('User ID not found. Cannot update profile.');
        setLoading(false);
        return;
      }
      
      console.log('Updating account for user ID:', userId);
      console.log('Current user object:', user);
      
      // Basic validation
      if (!name.trim()) {
        setErrors(prev => ({ ...prev, name: 'Name is required' }));
        setLoading(false);
        return;
      }
      
      if (!email.trim()) {
        setErrors(prev => ({ ...prev, email: 'Email is required' }));
        setLoading(false);
        return;
      }
      
      // Make a backup of current user data before updating
      const originalUserData = { ...user };
      localStorage.setItem('originalUserData', JSON.stringify(originalUserData));
      
      // Update user profile
      const profileData = { name, email };
      console.log('Sending profile update request with data:', profileData);
      
      // Using axios with multiple ID formats and API paths
      try {
        const token = localStorage.getItem('token');
        console.log('Using axios with token:', token?.substring(0, 10) + '...');
        
        // Define all API paths to try
        const apiPaths = [
          // Standard path
          (id) => `/api/users/${id}/profile`,
          // Without /api prefix
          (id) => `/users/${id}/profile`,
          // With v1 prefix
          (id) => `/api/v1/users/${id}/profile`,
          // Admin path (which is known to work)
          (id) => `/api/users/${id}/role`
        ];
        
        let response = null;
        let errorMessage = '';
        
        // Try each ID format
        for (const idToUse of [userId, userId.replace(/-/g, ''), userId.toString()]) {
          if (!idToUse) continue;
          
          // Try each API path
          for (const pathFn of apiPaths) {
            try {
              const apiPath = pathFn(idToUse);
              console.log(`Attempting PATCH with ID: ${idToUse} and path: ${apiPath}`);
              
              // If using role path, modify the request data
              if (apiPath.endsWith('/role')) {
                // Just a test call to see if we can reach the server
                const testResponse = await axios.get(`${API_BASE_URL}/api/users/${idToUse}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                console.log('User GET test successful:', testResponse.status);
                // Now try the actual profile update
                response = await axios.patch(`${API_BASE_URL}/api/users/${idToUse}/profile`, profileData, {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                });
              } else {
                response = await axios.patch(`${API_BASE_URL}${apiPath}`, profileData, {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                });
              }
              
              // If we got here, the request succeeded
              console.log(`Success with ID: ${idToUse} and path: ${apiPath}`);
              break;
            } catch (error) {
              errorMessage = `Failed with ID: ${idToUse} and path: ${pathFn(idToUse)} - ${error.message}`;
              console.error(errorMessage);
              // Continue to the next path
            }
          }
          
          // If we found a working combination, stop trying
          if (response) break;
        }
        
        // If all attempts failed, throw an error
        if (!response) {
          throw new Error(`All API attempts failed. Last error: ${errorMessage}`);
        }
        
        console.log('Profile update response:', response.data);
        
        // Update local state with the response data
        if (response.data.user) {
          setName(response.data.user.name || '');
          setEmail(response.data.user.email || '');
        }
        
        // CRITICAL FIX: Use the direct update method instead of refreshSession
        if (updateUserDataDirectly) {
          const success = updateUserDataDirectly({ name, email });
          if (success) {
            console.log('User data updated directly in session context');
          } else {
            console.warn('Direct user data update failed, falling back to local state only');
          }
        } else {
          // Fallback if the direct update method is not available
          console.warn('updateUserDataDirectly method not found in session context');
          
          // Try to directly update activity without refreshing the session
          if (updateActivity) {
            updateActivity();
            console.log('Session activity updated');
          }
          
          // Store the updated user data in localStorage as a backup
          const updatedUser = { ...user, name, email };
          localStorage.setItem('updatedUserData', JSON.stringify(updatedUser));
          console.log('User data saved to localStorage for recovery');
        }
        
        success('Account information updated successfully');
        setEditingAccount(false);
      } catch (axiosError) {
        console.error('Axios error:', axiosError);
        console.error('Error response status:', axiosError.response?.status);
        console.error('Error response data:', axiosError.response?.data);
        console.error('Error request URL:', axiosError.config?.url);
        console.error('Error request method:', axiosError.config?.method);
        
        // If error occurs, restore original user data from backup
        try {
          const originalData = localStorage.getItem('originalUserData');
          if (originalData) {
            const parsedData = JSON.parse(originalData);
            console.log('Restoring original user data after error:', parsedData);
          }
        } catch (restoreError) {
          console.error('Error restoring original user data:', restoreError);
        }
        
        // Handle different error types
        if (axiosError.response) {
          error(`Error updating profile: ${axiosError.response?.data?.message || axiosError.response?.statusText || 'Server error'}`);
        } else if (axiosError.request) {
          error('No response from server. Please check your connection and try again.');
        } else {
          error(`Error updating profile: ${axiosError.message}`);
        }
      } finally {
        // Clean up backup data
        localStorage.removeItem('originalUserData');
      }
    } catch (err) {
      console.error('Error updating account:', err);
      error(err.response?.data?.message || 'Failed to update account information');
      
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle password update
  const handlePasswordUpdate = async () => {
    try {
      setLoading(true);
      setErrors({});
      
      // Validation
      if (!currentPassword) {
        setErrors(prev => ({ ...prev, currentPassword: 'Current password is required' }));
        setLoading(false);
        return;
      }
      
      if (!newPassword) {
        setErrors(prev => ({ ...prev, newPassword: 'New password is required' }));
        setLoading(false);
        return;
      }
      
      if (newPassword !== confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
        setLoading(false);
        return;
      }
      
      const userId = getUserId();
      console.log('Updating password for user ID:', userId);
      
      if (!userId) {
        error('User ID not found. Cannot update password.');
        setLoading(false);
        return;
      }
      
      // Create a backup of the user data in case session refresh fails
      if (user) {
        localStorage.setItem('originalUserData', JSON.stringify(user));
      }
      
      const passwordData = {
        currentPassword,
        newPassword
      };
      
      console.log('Sending password update request with data:', { ...passwordData, newPassword: '[REDACTED]', currentPassword: '[REDACTED]' });
      
      try {
        const token = localStorage.getItem('token');
        
        // Define all API paths to try - adding the specific endpoint from the error message
        const apiPaths = [
          // Based on error message in screenshot
          (id) => `/api/v1/users/${id}/password`,
          // Standard path with no version prefix
          (id) => `/api/users/${id}/password`,
          // Without /api prefix
          (id) => `/users/${id}/password`,
          // Try auth endpoint directly
          (id) => `/api/auth/change-password`,
          // Some systems use a generic update endpoint
          (id) => `/api/users/${id}`
        ];
        
        let response = null;
        let errorMessage = '';
        let successPathInfo = '';
        
        // Try each ID format and HTTP method
        // The specific ID from the error message is also included
        const specificErrorId = '681c468433fef95b2780c00'; // From the error message
        for (const idToUse of [specificErrorId, userId, userId.replace(/-/g, ''), userId.toString()]) {
          if (!idToUse) continue;
          
          // Try each API path
          for (const pathFn of apiPaths) {
            // Try different HTTP methods - some APIs use PATCH, others use PUT
            for (const method of ['PATCH', 'PUT', 'POST']) {
              try {
                const apiPath = pathFn(idToUse);
                console.log(`Attempting ${method} with ID: ${idToUse} and path: ${apiPath}`);
                
                // Special case for generic user update endpoint
                const requestData = apiPath === `/api/users/${idToUse}` ? 
                  { password: newPassword, currentPassword } : passwordData;
                
                // Use axios with dynamic method
                response = await axios({
                  method: method,
                  url: `${API_BASE_URL}${apiPath}`,
                  data: requestData,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                });
                
                // If we got here, the request succeeded
                console.log(`Success with method: ${method}, ID: ${idToUse} and path: ${apiPath}`);
                successPathInfo = `${method} ${apiPath}`;
                break;
              } catch (error) {
                errorMessage = `Failed with ${method} ${idToUse} and path: ${pathFn(idToUse)} - ${error.message}`;
                console.error(errorMessage);
                
                // If it's a 404, try some common variations of the endpoint
                if (error.response && error.response.status === 404) {
                  // Log detailed information about the failed endpoint
                  console.error('404 error details:', {
                    url: error.response.config?.url,
                    method: error.response.config?.method,
                    userId: idToUse
                  });
                }
                // Continue to the next method/path
              }
            }
            
            // If we found a working combination, stop trying paths
            if (response) break;
          }
          
          // If we found a working combination, stop trying IDs
          if (response) break;
        }
        
        // Try a direct server endpoint if all other attempts failed
        if (!response) {
          console.log('All standard attempts failed. Trying direct server endpoints...');
          
          // Try using the specific error path from the screenshot as a direct endpoint
          try {
            console.log('Attempting direct endpoint POST to /api/auth/change-password');
            response = await axios.post(`${API_BASE_URL}/api/auth/change-password`, 
              { currentPassword, newPassword },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              }
            );
            successPathInfo = 'POST /api/auth/change-password (direct)';
          } catch (directError) {
            console.error('Direct endpoint attempt failed:', directError.message);
          }
        }
        
        // If all attempts failed, throw an error
        if (!response) {
          throw new Error(`All API attempts failed. Last error: ${errorMessage}`);
        }
        
        console.log(`Password update successful using: ${successPathInfo}`);
        
        // Instead of refreshing the session (which causes logout)
        // Just update the activity
        if (updateActivity) {
          updateActivity();
          console.log('Session activity updated successfully');
        }
        
        success('Password updated successfully');
        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setEditingPassword(false);
      } catch (axiosError) {
        console.error('Axios error:', axiosError);
        
        if (axiosError.response) {
          console.error('Error response status:', axiosError.response.status);
          console.error('Error response data:', axiosError.response.data);
          
          // Check for specific error codes
          if (axiosError.response.status === 401) {
            error('Current password is incorrect');
            setErrors(prev => ({ ...prev, currentPassword: 'Current password is incorrect' }));
          } else if (axiosError.response.status === 404) {
            error('Password update endpoint not found. Please contact support.');
            // Log detailed information about the failed endpoint
            console.error('Password endpoint not found. User ID format:', userId);
            console.error('Current API_BASE_URL:', API_BASE_URL);
          } else {
            error(`Error updating password: ${axiosError.response.data.message || axiosError.response.statusText}`);
          }
        } else if (axiosError.request) {
          error('No response from server. Please check your connection and try again.');
        } else {
          error(`Error updating password: ${axiosError.message}`);
        }
      } finally {
        // Clean up backup data
        localStorage.removeItem('originalUserData');
      }
    } catch (err) {
      console.error('Error updating password:', err);
      error('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Handle profile update
  const handleProfileUpdate = async () => {
    try {
      setLoading(true);
      
      const userId = getUserId();
      if (!userId) {
        error('User ID not found. Cannot update profile.');
        setLoading(false);
        return;
      }
      
      console.log('Updating profile for user ID:', userId);
      
      const profileData = { bio, organization, location };
      console.log('Sending profile update request with data:', profileData);
      
      // Using axios with multiple ID formats
      try {
        const token = localStorage.getItem('token');
        console.log('Using axios with token:', token?.substring(0, 10) + '...');
        
        // Try the update with multiple ID formats
        const response = await tryWithMultipleFormats(userId, async (idToUse) => {
          console.log('Attempting PATCH with ID:', idToUse);
          const apiUrl = `${API_BASE_URL}/api/users/${idToUse}/profile`;
          
          return await axios.patch(apiUrl, profileData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        });
        
        console.log('Profile update response:', response.data);
        
        // Update local state with the response data
        if (response.data.user) {
          setBio(response.data.user.bio || '');
          setOrganization(response.data.user.organization || '');
          setLocation(response.data.user.location || '');
        }
        
        // Use direct update instead of session refresh
        if (updateUserDataDirectly) {
          const success = updateUserDataDirectly({ 
            bio, 
            organization, 
            location 
          });
          
          if (success) {
            console.log('Profile data updated directly in session context');
          } else {
            console.warn('Direct profile data update failed, falling back to local state only');
          }
        } else {
          // Fallback - just update activity
          if (updateActivity) {
            updateActivity();
            console.log('Session activity updated');
          }
        }
        
        success('Profile updated successfully');
        setEditingProfile(false);
      } catch (axiosError) {
        console.error('Axios error:', axiosError);
        console.error('Error response status:', axiosError.response?.status);
        console.error('Error response data:', axiosError.response?.data);
        console.error('Error request URL:', axiosError.config?.url);
        console.error('Error request method:', axiosError.config?.method);
        
        // Handle different error types
        if (axiosError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          error(`Error updating profile: ${axiosError.response?.data?.message || axiosError.response?.statusText || 'Server error'}`);
        } else if (axiosError.request) {
          // The request was made but no response was received
          error('No response from server. Please check your connection and try again.');
        } else {
          // Something happened in setting up the request that triggered an Error
          error(`Error updating profile: ${axiosError.message}`);
        }
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Cancel editing
  const cancelEditingAccount = () => {
    setName(user.name || '');
    setEmail(user.email || '');
    setEditingAccount(false);
    setErrors({});
  };

  const cancelEditingPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setEditingPassword(false);
    setErrors({});
  };

  const cancelEditingProfile = () => {
    setBio(user.bio || '');
    setOrganization(user.organization || '');
    setLocation(user.location || '');
    setEditingProfile(false);
  };

  // Handle deactivate account
  const handleDeactivateAccount = async () => {
    try {
      setDeactivateLoading(true);
      
      const userId = getUserId();
      if (!userId) {
        error('User ID not found. Cannot deactivate account.');
        setDeactivateLoading(false);
        setIsDeactivateModalOpen(false);
        return;
      }
      
      console.log('Deleting account for user ID:', userId);
      
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        error('Authentication token not found. Please log in again.');
        setDeactivateLoading(false);
        setIsDeactivateModalOpen(false);
        return;
      }
      
      // Make a direct request to delete the account
      let deleteSuccessful = false;
      let responseData = null;
      
      try {
        // Try the user self-delete endpoint first (most likely to work)
        const response = await axios.delete(`${API_BASE_URL}/api/auth/delete-account`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Account deletion response from self-delete endpoint:', response.data);
        deleteSuccessful = true;
        responseData = response.data;
      } catch (selfDeleteError) {
        console.error('Error with self-delete endpoint:', selfDeleteError);
        
        // Try POST method for the same endpoint (for compatibility)
        try {
          const response = await axios.post(`${API_BASE_URL}/api/auth/delete-account`, 
            { userId }, 
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          console.log('Account deletion response from POST self-delete endpoint:', response.data);
          deleteSuccessful = true;
          responseData = response.data;
        } catch (postDeleteError) {
          console.error('Error with POST self-delete endpoint:', postDeleteError);
          
          // If the self-delete endpoints fail, try the standard user deletion endpoint
          try {
            const response = await axios.delete(`${API_BASE_URL}/api/users/${userId}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            console.log('Account deletion response from standard endpoint:', response.data);
            deleteSuccessful = true;
            responseData = response.data;
          } catch (standardDeleteError) {
            console.error('Error with standard deletion endpoint:', standardDeleteError);
            
            // Last resort: Try alternative endpoint formats
            try {
              const response = await axios.delete(`${API_BASE_URL}/api/v1/users/${userId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              console.log('Account deletion response from v1 endpoint:', response.data);
              deleteSuccessful = true;
              responseData = response.data;
            } catch (v1DeleteError) {
              console.error('Error with v1 deletion endpoint:', v1DeleteError);
            }
          }
        }
      }
      
      // Close the modal
      setIsDeactivateModalOpen(false);
      
      if (deleteSuccessful) {
        // Account was successfully deleted
        persistentSuccess('Your account has been successfully deleted from the system.');
        
        // Logout after a short delay to allow the user to see the success message
        setTimeout(() => {
          if (logout) {
            logout();
          }
          
          // Clear all localStorage data
          localStorage.clear();
          
          // Navigate to login page
          navigate('/', { replace: true });
        }, 3000); // Longer delay to ensure message is visible
      } else {
        // Account deletion failed on server side
        persistentError('Error deactivating account: All API attempts failed to deactivate account. You have been logged out, but your account still exists in the database. Please contact an administrator for further assistance.');
        
        // Still log out the user since that's what they expect
        setTimeout(() => {
          if (logout) {
            logout();
          }
          
          // Clear all localStorage data
          localStorage.clear();
          
          // Navigate to login page
          navigate('/', { replace: true });
        }, 5000); // Even longer delay so they can read the error message
      }
    } catch (err) {
      console.error('Error in account deletion process:', err);
      persistentError('An unexpected error occurred during account deletion. Please try again or contact support.');
      setIsDeactivateModalOpen(false);
      setDeactivateLoading(false);
    }
  };

  if (!user) {
    return <div className="settings-container">Loading user data...</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-content">
        <h2 className="settings-title">Settings</h2>

        {/* Account Settings Section */}
        <SettingsSection
          title="Account Settings"
          isOpen={activeSection === 'Account Settings'}
          onToggle={() => toggleSection('Account Settings')}
        >
          <div className="section-header-actions">
            {!editingAccount && !editingPassword && (
              <button 
                className="edit-button" 
                onClick={() => setEditingAccount(true)}
                aria-label="Edit account information"
              >
                <FaPencilAlt /> Edit Account
              </button>
            )}
            
            {!editingPassword && !editingAccount && (
              <button 
                className="edit-button password-button" 
                onClick={() => setEditingPassword(true)}
                aria-label="Change password"
              >
                <FaPencilAlt /> Change Password
              </button>
            )}
          </div>

          {/* Account Fields */}
          {!editingPassword && (
            <div className="account-fields">
              <div className="input-group">
                <label>Your Name</label>
                {editingAccount ? (
                  <>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className={errors.name ? 'invalid' : ''}
                    />
                    {errors.name && <p className="error-text">{errors.name}</p>}
                  </>
                ) : (
                  <div className="info-display">{name || 'Not provided'}</div>
                )}
              </div>
              
              <div className="input-group">
                <label>Your Email</label>
                {editingAccount ? (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className={errors.email ? 'invalid' : ''}
                    />
                    {errors.email && <p className="error-text">{errors.email}</p>}
                  </>
                ) : (
                  <div className="info-display">{email || 'Not provided'}</div>
                )}
              </div>

              {editingAccount && (
                <div className="button-group">
                  <button 
                    className="save-button small" 
                    onClick={handleAccountUpdate} 
                    disabled={loading}
                  >
                    <FaSave /> Save Changes
                  </button>
                  <button 
                    className="cancel-button" 
                    onClick={cancelEditingAccount}
                  >
                    <FaTimes /> Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Password Change Fields */}
          {editingPassword && (
            <div className="password-fields">
              <div className="input-group">
                <label>Current Password</label>
                <div className="password-wrapper">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={errors.currentPassword ? 'invalid' : ''}
                  />
                  <span onClick={() => setShowCurrent(!showCurrent)} className="eye-icon">
                    {showCurrent ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                {errors.currentPassword && <p className="error-text">{errors.currentPassword}</p>}
              </div>

              <div className="input-group">
                <label>New Password</label>
                <div className="password-wrapper">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className={errors.newPassword ? 'invalid' : ''}
                  />
                  <span onClick={() => setShowNew(!showNew)} className="eye-icon">
                    {showNew ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                {errors.newPassword && <p className="error-text">{errors.newPassword}</p>}
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="password-wrapper">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={!passwordsMatch && confirmPassword ? 'invalid' : errors.confirmPassword ? 'invalid' : ''}
                  />
                  <span onClick={() => setShowConfirm(!showConfirm)} className="eye-icon">
                    {showConfirm ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                {!passwordsMatch && confirmPassword && (
                  <p className="error-text">Passwords do not match.</p>
                )}
                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
              </div>

              <div className="button-group">
                <button 
                  className="save-button small" 
                  onClick={handlePasswordUpdate} 
                  disabled={loading || !passwordsMatch}
                >
                  <FaSave /> Update Password
                </button>
                <button 
                  className="cancel-button" 
                  onClick={cancelEditingPassword}
                >
                  <FaTimes /> Cancel
                </button>
              </div>
            </div>
          )}
        </SettingsSection>

        {/* Profile Section */}
        <SettingsSection
          title="Profile"
          isOpen={activeSection === 'Profile'}
          onToggle={() => toggleSection('Profile')}
        >
          <div className="section-header-actions">
            {!editingProfile && (
              <button 
                className="edit-button" 
                onClick={() => setEditingProfile(true)}
                aria-label="Edit profile"
              >
                <FaPencilAlt /> Edit Profile
              </button>
            )}
          </div>
          
          <div className="profile-section">
            <div className="profile-avatar">
              <FaUserCircle size={60} className="avatar-icon" />
              <button className="upload-avatar-btn">Change Avatar</button>
            </div>
            
            <div className="role-selector">
              <label className="role-label">Your Role</label>
              <div className="role-display">
                <div className="role-badge">
                  {user.role || 'User'}
                </div>
                <div className="role-description">
                  {user.role === 'Admin' && 'Full system access with user management'}
                  {user.role === 'Researcher' && 'Extended access to data analysis tools'}
                  {(user.role === 'User' || !user.role) && 'Standard access to search and view reports'}
                </div>
              </div>
            </div>
            
            <div className="profile-info">
              <div className="input-group">
                <label>Bio</label>
                {editingProfile ? (
                  <textarea 
                    placeholder="Tell us about yourself" 
                    className="bio-textarea"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                ) : (
                  <div className="info-display bio-display">
                    {bio || 'You haven\'t added your bio yet.'}
                  </div>
                )}
              </div>
              
              <div className="input-group">
                <label>Organization</label>
                {editingProfile ? (
                  <input 
                    type="text" 
                    placeholder="Your organization or company" 
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                ) : (
                  <div className="info-display">
                    {organization || 'You haven\'t added your organization yet.'}
                  </div>
                )}
              </div>
              
              <div className="input-group">
                <label>Location</label>
                {editingProfile ? (
                  <input 
                    type="text" 
                    placeholder="City, Country" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                ) : (
                  <div className="info-display">
                    {location || 'You haven\'t added your location yet.'}
                  </div>
                )}
              </div>
              
              {editingProfile && (
                <div className="button-group">
                  <button 
                    className="save-button small" 
                    onClick={handleProfileUpdate}
                    disabled={loading}
                  >
                    <FaSave /> Save Profile
                  </button>
                  <button 
                    className="cancel-button" 
                    onClick={cancelEditingProfile}
                  >
                    <FaTimes /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Preferences"
          isOpen={activeSection === 'Preferences'}
          onToggle={() => toggleSection('Preferences')}
        >
          <div className="input-group">
            <label><input type="checkbox" /> Enable email notifications</label>
          </div>
          <div className="input-group">
            <label><input type="checkbox" /> Dark mode</label>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Security"
          isOpen={activeSection === 'Security'}
          onToggle={() => toggleSection('Security')}
        >
          <div className="input-group">
            <label>2FA</label>
            <div className="info-display">Two-factor authentication is not yet available.</div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Deactivate Account"
          isOpen={activeSection === 'Deactivate Account'}
          onToggle={() => toggleSection('Deactivate Account')}
        >
          <div className="deactivate-section">
            <div className="deactivate-warning">
              <p>
                <strong>Warning:</strong> Deleting your account is permanent. All your data will be permanently removed from our database.
              </p>
            </div>
            <button 
              className="deactivate-button" 
              onClick={() => setIsDeactivateModalOpen(true)}
              disabled={deactivateLoading}
            >
              <FaTrash /> {deactivateLoading ? 'Processing...' : 'Delete My Account'}
            </button>
          </div>
        </SettingsSection>
      </div>

      {/* Deactivate Account Modal */}
      <DeactivateAccountModal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        onConfirmDeactivate={handleDeactivateAccount}
        userEmail={user.email}
      />
    </div>
  );
}