// UserContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';

// Create a context for user data
const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
  // Get the initial role from localStorage or default to 'User'
  const [userRole, setUserRole] = useState(
    localStorage.getItem('userRole') || 'User'
  );

  // Update localStorage whenever userRole changes
  useEffect(() => {
    localStorage.setItem('userRole', userRole);
  }, [userRole]);

  // Create a function to update the role
  const updateUserRole = (newRole) => {
    setUserRole(newRole);
  };

  // Value to be provided to consuming components
  const value = {
    userRole,
    updateUserRole
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook to use the user context
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;