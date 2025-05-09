// App.js - Updated to integrate SessionProvider with existing AuthContext
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import AdvancedSearch from './AdvancedSearch';
import GeographicDistribution from './GeographicDistribution'; 
import Influencers from './Influencers';
import LoginPage from './LoginPage';
import SignUpPage from './SignUpPage';
import ForgotPassword from './ForgotPassword';
import NewPassword from './NewPassword';
import ThemesPage from './ThemesPage';
import MostEngagementPage from './MostEngagementPage';
import SourceDistribution from './SourceDistribution';
import SentimentAnalysis from './SentimentAnalysis';
import SeasonalAnalysis from './SeasonalAnalysis';
import HelpPage from './HelpPage';
import SettingsPage from './SettingsPage';
import AdminPage from './AdminPage'; // Import AdminPage
import RoleManagementPage from './RoleManagementPage'; // Import RoleManagementPage
import Sidebar from './Sidebar';
import Topbar from './Topbar'; // Import Topbar
import { SessionProvider, useSession } from './contexts/SessionContext'; // Import SessionContext
import SessionTimeout from './components/SessionTimeout'; // Add session timeout component
import { UserProvider, useUser } from './UserContext'; // Keep existing UserContext
import { FlashMessageProvider } from './contexts/FlashMessageContext';
import FlashMessage from './components/FlashMessage';
import LoadingScreen from './components/LoadingScreen'; // Import the new LoadingScreen component
import './App.css';
import './Sidebar.css';

// Create AuthContext (keeping for backward compatibility)
const AuthContext = createContext();

// Layout wrapper that includes Sidebar and shifts content dynamically
const LayoutWithSidebar = ({ Component, pageName }) => {
  const navigate = useNavigate();
  const { setIsAuthenticated } = useContext(AuthContext);
  const { userRole, updateUserRole } = useUser(); // Use existing UserContext hook
  const { logout, updateActivity, user } = useSession(); // Get user from SessionContext
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Navigate function used inside all pages
  const navigateTo = (page, params) => {
    // Update user activity when navigating
    updateActivity();
    
    switch(page) {
      case 'dashboard':
        navigate('/dashboard', { state: params });
        break;
      case 'advancedSearch':
        navigate('/advanced-search', { state: params });
        break;
      case 'influencers':
        navigate('/influencers', { state: params });
        break;
      case 'themes':
        navigate('/themes', { state: params });
        break;
      case 'engagement':
        navigate('/most-engagement', { state: params });
        break;
      case 'geographical':
        navigate('/geographic-distribution', { state: params });
        break;
      case 'source':
        navigate('/source-distribution', { state: params }); 
        break;
      case 'sentiment':
        navigate('/sentiment-analysis', { state: params }); 
        break;
      case 'seasonal':
        navigate('/seasonal-analysis', { state: params }); 
        break;
      case 'help':
        navigate('/help', { state: params });
        break;
      case 'settings':
        navigate('/settings', { state: params });
        break;
      case 'admin':
        navigate('/admin', { state: params });
        break;
      case 'roleManagement':
        navigate('/role-management', { state: params });
        break;
      case 'logout':
        // Use the new logout function from SessionContext
        logout();
        
        // Update the authentication state from AuthContext
        setIsAuthenticated(false);
        
        // Use navigate with replace option to prevent back-button returning to authenticated pages
        navigate('/', { replace: true });
        break;
      default:
        navigate(page, { state: params });
    }
  };

  // Get component props based on page type
  const getComponentProps = () => {
    if (pageName === 'settings') {
      return {
        onRoleChange: updateUserRole,
        navigateTo
      };
    }
    
    return {
      navigateTo, 
      currentPage: pageName,
      userRole: user, // Use the user from SessionContext
      user // Pass the entire user object for components that need it
    };
  };

  useEffect(() => {
    console.log('LayoutWithSidebar rendering with user:', user);
  }, [user]);

  return (
    <div className="layout">
      {/* Sidebar with callback for open/close state */}
      <Sidebar
        currentPage={pageName}
        navigateTo={navigateTo}
        onToggle={(open) => setSidebarOpen(open)}
        userRole={user} // Pass the user from SessionContext
      />
      {/* Main content shifts depending on sidebar state */}
      <div className={`main-content ${sidebarOpen ? 'shifted' : 'full'}`}>
        <Topbar /> {/* Add Topbar to all pages */}
        <Component {...getComponentProps()} />
      </div>
    </div>
  );
};

// Enhanced protected route component that uses both old and new authentication
const EnhancedProtectedRoute = ({ component: Component, pageName }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const { isAuthenticated: sessionAuthenticated, loading, user } = useSession();
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [hasRequiredPermission, setHasRequiredPermission] = useState(true); // Assume permission by default
  
  // Map pageName to permission ID
  const permissionMap = {
    'advancedSearch': 'advancedSearch',
    'dashboard': 'dashboard',
    'influencers': 'influencers',
    'themes': 'themes',
    'engagement': 'engagement',
    'geographical': 'geographical',
    'source': 'source',
    'sentiment': 'sentiment',
    'seasonal': 'seasonal',
    'help': 'help',
    'settings': 'settings'
  };
  
  // Basic permissions that every authenticated user should have
  const defaultUserPermissions = ['advancedSearch', 'dashboard', 'help'];
  
  // Effect to check permissions once user data is loaded
  useEffect(() => {
    if (loading) return;
    
    // Only set checking permissions to true for non-default routes
    if (!defaultUserPermissions.includes(permissionMap[pageName])) {
      setCheckingPermissions(true);
    }
    
    // Check if user has permission for this page
    const checkPermission = () => {
      // Check for demo user admin status in localStorage
      const isDemoAdmin = localStorage.getItem('isAdmin') === 'true';
      const demoUserJson = localStorage.getItem('demoUser');
      
      // Log debugging information
      console.log(`Checking permission for ${pageName} route with:`, {
        isAdmin: user?.isAdmin || isDemoAdmin,
        userExists: !!user,
        role: user?.role || localStorage.getItem('userRole'),
        permissionsExist: !!user?.permissions,
        permissionsLength: user?.permissions?.length || 0,
        specificPermission: user?.permissions?.includes(permissionMap[pageName]),
        isDemoAdmin
      });

      // Admin users (including demo admin) have access to everything
      if (user?.isAdmin || isDemoAdmin) {
        setHasRequiredPermission(true);
        setCheckingPermissions(false);
        return;
      }
      
      const permissionId = permissionMap[pageName];
      
      // If user has permissions provided by the server, use them directly
      if (user?.permissions && user.permissions.length > 0) {
        setHasRequiredPermission(user.permissions.includes(permissionId));
        setCheckingPermissions(false);
        return;
      }
      
      // Check if there's a demo user with permissions
      if (demoUserJson) {
        try {
          const demoUser = JSON.parse(demoUserJson);
          if (demoUser.permissions && demoUser.permissions.includes(permissionId)) {
            setHasRequiredPermission(true);
            setCheckingPermissions(false);
            return;
          }
        } catch (e) {
          console.error("Error parsing demo user:", e);
        }
      }
      
      // For "User" role with no permissions provided, use all permissions from database
      // This matches what's in the MongoDB database showing User role with all permissions
      if (user?.role === 'User' || localStorage.getItem('userRole') === 'User') {
        // Based on what we saw in the database, User role has access to all these pages
        const userRolePermissions = [
          'advancedSearch', 'dashboard', 'help', 'influencers', 'themes', 
          'engagement', 'geographical', 'source', 'sentiment', 'seasonal', 'settings'
        ];
        setHasRequiredPermission(userRolePermissions.includes(permissionId));
        setCheckingPermissions(false);
        return;
      }
      
      // If no role or permissions at all, fall back to basic permissions
      setHasRequiredPermission(defaultUserPermissions.includes(permissionId));
      setCheckingPermissions(false);
    };
    
    checkPermission();
  }, [loading, user, pageName]);
  
  // Check both authentication systems during transition period
  // Later, you can remove the AuthContext dependency completely
  const isUserAuthenticated = isAuthenticated || sessionAuthenticated;
  
  // If not authenticated at all, redirect to login
  if (!isUserAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Use the new LoadingScreen component for a smoother experience
  // We only show loading for non-basic pages to prevent flashing
  const shouldShowLoading = loading && checkingPermissions && 
    !defaultUserPermissions.includes(permissionMap[pageName]);
  
  // If user doesn't have permission, show access denied
  if (!hasRequiredPermission && !loading) {
    return (
      <div className="access-denied-page">
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }
  
  return (
    <>
      <LoadingScreen isLoading={shouldShowLoading} delay={300} />
      <LayoutWithSidebar Component={Component} pageName={pageName} />
    </>
  );
};

// Admin-only protected route
const AdminProtectedRoute = ({ component: Component }) => {
  const { user, isAuthenticated: sessionAuthenticated, loading } = useSession();
  const { isAuthenticated } = useContext(AuthContext);
  
  // Check for admin status in multiple places
  const isAdmin = user?.isAdmin || localStorage.getItem('isAdmin') === 'true';
  
  // Check both authentication systems
  const isUserAuthenticated = isAuthenticated || sessionAuthenticated;
  
  // Not authenticated at all - redirect to login
  if (!isUserAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Use the new LoadingScreen component
  const shouldShowLoading = loading && !isAdmin;
  
  // User is authenticated but not an admin - show access denied
  if (!isAdmin && !loading) {
    return (
      <div className="access-denied-page">
        <h1>Access Denied</h1>
        <p>You need administrator privileges to access this page.</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }
  
  return (
    <>
      <LoadingScreen isLoading={shouldShowLoading} delay={300} />
      <LayoutWithSidebar Component={Component} pageName="admin" />
    </>
  );
};

function App() {

  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );
  
  // Update localStorage whenever isAuthenticated changes
  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated);
  }, [isAuthenticated]);
  
  // Handle login - Make this more efficient by using callback pattern
  const handleLogin = useCallback(() => {
    console.log('Setting authenticated state to true');
    setIsAuthenticated(true);
  }, []);

  // Create a ref to store the setIsAuthenticated function
  const setIsAuthenticatedRef = useRef(setIsAuthenticated);
  useEffect(() => {
    setIsAuthenticatedRef.current = setIsAuthenticated;
  }, [setIsAuthenticated]);
  
  // Register the logout handler with SessionContext
  const handleExternalLogout = useCallback(() => {
    // This will be called whenever SessionContext's logout is triggered
    setIsAuthenticatedRef.current(false);
  }, []);

  return (
    <UserProvider>
      <SessionProvider>
        <FlashMessageProvider>
          <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
            <LogoutHandlerRegistration onLogout={handleExternalLogout} />
            <Router>
              {/* Add SessionTimeout component for inactivity detection */}
              <SessionTimeout />
              
              <div className="App">
                <FlashMessage />
                <Routes>
                  {/* Public routes - accessible without authentication */}
                  {/* Use component pattern instead of inline redirect for login to prevent flashing */}
                  <Route path="/" element={<LoginRedirect onLogin={handleLogin} />} />
                  <Route path="/sign-up" element={<SignUpPage />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/new-password" element={<NewPassword />} />

                  {/* Protected routes - require authentication */}
                  <Route 
                    path="/advanced-search" 
                    element={<EnhancedProtectedRoute component={AdvancedSearch} pageName="advancedSearch" />} 
                  />
                  <Route 
                    path="/dashboard" 
                    element={<EnhancedProtectedRoute component={Dashboard} pageName="dashboard" />} 
                  />
                  <Route 
                    path="/influencers" 
                    element={<EnhancedProtectedRoute component={Influencers} pageName="influencers" />} 
                  />
                  <Route 
                    path="/themes" 
                    element={<EnhancedProtectedRoute component={ThemesPage} pageName="themes" />} 
                  />
                  <Route 
                    path="/most-engagement" 
                    element={<EnhancedProtectedRoute component={MostEngagementPage} pageName="engagement" />} 
                  />
                  <Route 
                    path="/geographic-distribution" 
                    element={<EnhancedProtectedRoute component={GeographicDistribution} pageName="geographical" />} 
                  />
                  
                  {/* Routes for the three additional components */}
                  <Route 
                    path="/source-distribution" 
                    element={<EnhancedProtectedRoute component={SourceDistribution} pageName="source" />} 
                  />
                  <Route 
                    path="/sentiment-analysis" 
                    element={<EnhancedProtectedRoute component={SentimentAnalysis} pageName="sentiment" />} 
                  />
                  <Route 
                    path="/seasonal-analysis" 
                    element={<EnhancedProtectedRoute component={SeasonalAnalysis} pageName="seasonal" />} 
                  />
                  <Route 
                    path="/help" 
                    element={<EnhancedProtectedRoute component={HelpPage} pageName="help" />}
                  />
                  <Route 
                    path="/settings" 
                    element={<EnhancedProtectedRoute component={SettingsPage} pageName="settings" />}
                  />
                  
                  {/* Admin-only route */}
                  <Route 
                    path="/admin" 
                    element={<AdminProtectedRoute component={AdminPage} />}
                  />
                  <Route 
                    path="/role-management" 
                    element={<AdminProtectedRoute component={RoleManagementPage} />}
                  />
                  
                  {/* Redirect any unknown paths to advanced search if authenticated, or login if not */}
                  <Route path="*" element={
                    isAuthenticated ? <Navigate to="/advanced-search" /> : <Navigate to="/" />
                  } />
                </Routes>
              </div>
            </Router>
          </AuthContext.Provider>
        </FlashMessageProvider>
      </SessionProvider>
    </UserProvider>
  );
}

// Component to handle login redirect more efficiently
function LoginRedirect({ onLogin }) {
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      // Use navigate instead of Navigate component to prevent UI flash
      navigate('/advanced-search', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  // Directly return login page if not authenticated
  return <LoginPage onLogin={onLogin} />;
}

function LogoutHandlerRegistration({ onLogout }) {
  const { registerLogoutHandler } = useSession();
  
  useEffect(() => {
    registerLogoutHandler(onLogout);
  }, [registerLogoutHandler, onLogout]);
  
  return null; // This component doesn't render anything
}

export default App;