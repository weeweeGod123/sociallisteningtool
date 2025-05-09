import React, { useState, useEffect } from 'react';
import {
  Search, Grid, ChevronRight, User, BarChart2, 
  PieChart, FileText, TrendingUp, Database,
  HelpCircle, Settings, LogOut, Menu, X, Zap
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ navigateTo, currentPage, onToggle, userRole }) => {
  const [isOpen, setIsOpen] = useState(true); // Sidebar open state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Logout confirmation dialog state

  // Log user role information for debugging
  useEffect(() => {
    console.log('Sidebar received userRole:', userRole);
    if (userRole?.permissions) {
      console.log('Permissions available:', userRole.permissions);
    } else {
      console.log('No permissions found in userRole');
    }
  }, [userRole]);

  // Toggle sidebar open/close
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    if (onToggle) onToggle(!isOpen); // Notify parent layout to shift page
  };

  // Handle logout button click
  const handleLogoutClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowLogoutConfirm(true);
  };

  // Confirm logout
  const handleConfirmedLogout = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigateTo('logout');
    setShowLogoutConfirm(false);
  };

  // Cancel logout
  const cancelLogout = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowLogoutConfirm(false);
  };

  // Check if user has admin privileges
  const isAdmin = userRole?.isAdmin || localStorage.getItem('isAdmin') === 'true';
  
  // Check if a user has permission for a specific page
  const hasPermission = (pageId) => {
    // Check for demo user in localStorage
    const demoUserJson = localStorage.getItem('demoUser');
    let demoUser = null;
    if (demoUserJson) {
      try {
        demoUser = JSON.parse(demoUserJson);
      } catch (e) {
        console.error("Error parsing demo user:", e);
      }
    }
    
    // Log debugging information
    if (pageId === 'advancedSearch') {
      console.log(`Checking permission for ${pageId} with:`, {
        isAdmin: isAdmin,
        userRoleExists: !!userRole,
        role: userRole?.role || localStorage.getItem('userRole'),
        permissionsExist: !!userRole?.permissions || !!demoUser?.permissions,
        permissionsLength: userRole?.permissions?.length || demoUser?.permissions?.length || 0,
        specificPermission: userRole?.permissions?.includes(pageId) || demoUser?.permissions?.includes(pageId),
        isDemoUser: !!demoUser
      });
    }

    // If user is admin, they have access to everything
    if (isAdmin) return true;
    
    // Check demo user permissions first
    if (demoUser?.permissions && demoUser.permissions.includes(pageId)) {
      return true;
    }
    
    // Basic permissions that every authenticated user should have
    const defaultUserPermissions = ['advancedSearch', 'dashboard', 'help'];
    
    // If user has permissons provided by the server, use them directly
    if (userRole?.permissions && userRole.permissions.length > 0) {
      // If user has this specific permission
      return userRole.permissions.includes(pageId);
    }
    
    // For "User" role with no permissions provided, use all permissions from database
    // This matches what's in the MongoDB database showing User role with all permissions
    if (userRole?.role === 'User' || localStorage.getItem('userRole') === 'User') {
      // Based on what we saw in the database, User role has access to all these pages
      const userRolePermissions = [
        'advancedSearch', 'dashboard', 'help', 'influencers', 'themes', 
        'engagement', 'geographical', 'source', 'sentiment', 'seasonal', 'settings'
      ];
      return userRolePermissions.includes(pageId);
    }
    
    // If no role or permissions at all, fall back to basic permissions
    return defaultUserPermissions.includes(pageId);
  };

  return (
    <>
      {/* Sidebar Container */}
      <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          {/* Show full or short title depending on state */}
          <h2>{isOpen ? 'Social Media Monitor 21' : '21'}</h2>

          {/* Sidebar toggle button */}
          <button className="toggle-button" onClick={toggleSidebar}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="sidebar-content">
          <div className="sidebar-section">
            {/* Navigation Links - Only show if user has permission */}
            {hasPermission('advancedSearch') && (
              <div className={`sidebar-item ${currentPage === 'advancedSearch' ? 'active' : ''}`} onClick={() => navigateTo('advancedSearch')}>
                <Search size={20} />
                <span>Advanced Search</span>
              </div>
            )}
            
            {hasPermission('dashboard') && (
              <div className={`sidebar-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}>
                <Grid size={20} />
                <span>Dashboard</span>
              </div>
            )}
            
            {hasPermission('influencers') && (
              <div className={`sidebar-item ${currentPage === 'influencers' ? 'active' : ''}`} onClick={() => navigateTo('influencers')}>
                <User size={20} />
                <span>Top Influencers</span>
              </div>
            )}
            
            {hasPermission('themes') && (
              <div className={`sidebar-item ${currentPage === 'themes' ? 'active' : ''}`} onClick={() => navigateTo('themes')}>
                <FileText size={20} />
                <span>Top Themes</span>
              </div>
            )}
            
            {hasPermission('engagement') && (
              <div className={`sidebar-item ${currentPage === 'engagement' ? 'active' : ''}`} onClick={() => navigateTo('engagement')}>
                <Zap size={20} />
                <span>Most Engagement</span>
              </div>
            )}
            
            {hasPermission('geographical') && (
              <div className={`sidebar-item ${currentPage === 'geographical' ? 'active' : ''}`} onClick={() => navigateTo('geographical')}>
                <BarChart2 size={20} />
                <span className="no-wrap">Geographical Distribution</span>
              </div>
            )}
            
            {hasPermission('source') && (
              <div className={`sidebar-item ${currentPage === 'source' ? 'active' : ''}`} onClick={() => navigateTo('source')}>
                <Database size={20} />
                <span>Source Distribution</span>
              </div>
            )}
            
            {hasPermission('sentiment') && (
              <div className={`sidebar-item ${currentPage === 'sentiment' ? 'active' : ''}`} onClick={() => navigateTo('sentiment')}>
                <PieChart size={20} />
                <span>Sentiment Analysis</span>
              </div>
            )}
            
            {hasPermission('seasonal') && (
              <div className={`sidebar-item ${currentPage === 'seasonal' ? 'active' : ''}`} onClick={() => navigateTo('seasonal')}>
                <TrendingUp size={20} />
                <span>Seasonal Analysis</span>
              </div>
            )}
          </div>

          {/* Bottom Section - Help, Settings, Logout */}
          <div className="sidebar-section bottom-section">
            {hasPermission('help') && (
              <div className={`sidebar-item ${currentPage === 'help' ? 'active' : ''}`} onClick={() => navigateTo('help')}>
                <HelpCircle size={20} />
                <span>Help</span>
              </div>
            )}
            
            {hasPermission('settings') && (
              <div className={`sidebar-item ${currentPage === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}>
                <Settings size={20} />
                <span>Settings</span>
              </div>
            )}
            
            <div className="sidebar-item" onClick={handleLogoutClick}>
              <LogOut size={20} />
              <span>Log out</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="logout-confirm-overlay" onClick={cancelLogout}>
          <div className="logout-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="logout-buttons">
              <button className="cancel-button" onClick={cancelLogout}>Cancel</button>
              <button className="confirm-button" onClick={handleConfirmedLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
