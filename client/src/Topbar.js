// Topbar.js (Updated with Session Management)
import React, { useState, useRef, useEffect } from 'react';
import { Bell, RefreshCcw, Download, User, LogOut, Settings, Shield, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './UserContext'; // Import for legacy role support
import { useSession } from './contexts/SessionContext'; // Import for session management
import './Topbar.css';
import Logo from './assets/Logo.png'; // Import the logo image

function Topbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { userRole } = useUser(); // For legacy role support
  
  // Session management
  const { user, logout, updateActivity } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Logout confirmation dialog state
  const dropdownRef = useRef(null);
  
  // Get actual role (prefer session context over legacy)
  const role = user?.role || userRole || 'User';
  // Check if user is an admin
  const isAdmin = user?.isAdmin || false;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Record user activity
      updateActivity();
      
      navigate('/advanced-search', { state: { initialQuery: searchQuery } });
      setSearchQuery('');
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getRoleBadgeStyle = () => {
    if (isAdmin) {
      return 'user-profile admin-role';
    }
    
    switch(role.toLowerCase()) {
      case 'researcher':
        return 'user-profile researcher-role';
      default:
        return 'user-profile user-role';
    }
  };
  
  const handleUserMenuClick = () => {
    // Record user activity
    updateActivity();
    setDropdownOpen(!dropdownOpen);
  };
  
  const handleLogout = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen(false);
    setShowLogoutConfirm(true);
  };
  
  const navigateTo = (path) => {
    setDropdownOpen(false);
    updateActivity();
    navigate(path);
  };

    // Confirm logout
    const handleConfirmedLogout = (e) => {
      logout();
      navigate('/login');
    };
  
    // Cancel logout
    const cancelLogout = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setShowLogoutConfirm(false);
    };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <img src={Logo} alt="Logo" className="logo-image" />
        <h1 className="brand">Social Media Monitor 21</h1>
        <form className="search-container" onSubmit={handleSearch}>
          <input 
            className="search-input" 
            type="text" 
            placeholder="Type here to search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-button">Search</button>
        </form>
      </div>
      
      <div className="topbar-right">
        <RefreshCcw size={18} className="icon" />
        <Bell size={18} className="icon" />
        <Download size={18} className="icon" />
        
        {/* User profile section with dropdown */}
        <div className="user-dropdown" ref={dropdownRef}>
          <div 
            className={getRoleBadgeStyle()}
            onClick={handleUserMenuClick}
          >
            <User size={18} />
            <span>{user?.name || 'User'}</span>
            <ChevronDown size={14} className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`} />
          </div>
          
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-header">
                <p className="dropdown-name">{user?.name || 'User'}</p>
                <p className="dropdown-email">{user?.email || ''}</p>
                <span className="dropdown-role">{role}</span>
                {isAdmin && <span className="dropdown-admin-badge">Admin</span>}
              </div>
              
              <div className="dropdown-items">
                <div 
                  className="dropdown-item"
                  onClick={() => navigateTo('/settings')}
                >
                  <User size={16} />
                  <span>Account</span>
                </div>
                
                <div 
                  className="dropdown-item"
                  onClick={() => navigateTo('/settings')}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </div>
                
                {/* Show Admin option if user is an admin, regardless of role */}
                {isAdmin && (
                  <div 
                    className="dropdown-item"
                    onClick={() => navigateTo('/admin')}
                  >
                    <Shield size={16} />
                    <span>Admin Panel</span>
                  </div>
                )}
                
                <div 
                  className="dropdown-item logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
}

export default Topbar;