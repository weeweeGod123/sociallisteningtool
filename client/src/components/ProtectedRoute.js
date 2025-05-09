// client/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

/**
 * A route wrapper that redirects to login if user is not authenticated
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The components to render if authenticated
 * @param {string[]} [props.requiredRoles] - Optional array of roles required to access this route
 * @param {boolean} [props.requireAdmin] - Whether this route requires admin access
 * @returns {React.ReactNode}
 */
const ProtectedRoute = ({ children, requiredRoles, requireAdmin }) => {
    const { user, isAuthenticated, loading } = useSession();
    const location = useLocation();

    // Show loading state while checking authentication
    if (loading) 
    {
        return (
        <div className="loading-screen">
            <div className="spinner"></div>
            <p>Loading...</p>
        </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) 
    {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // If admin access is required, check isAdmin flag
    if (requireAdmin && !user.isAdmin) 
    {
        return (
            <div className="access-denied">
                <h2>Access Denied</h2>
                <p>You need administrator privileges to access this page.</p>
                <button onClick={() => window.history.back()}>Go Back</button>
            </div>
        );
    }

    // Check for required roles if specified
    if (requiredRoles && requiredRoles.length > 0) 
    {
        // Allow access if user is an admin, regardless of role
        if (user.isAdmin) {
            return children;
        }

        const hasRequiredRole = requiredRoles.includes(user.role);
        
        if (!hasRequiredRole) 
        {
            // User does not have required role, show access denied message
            return (
                <div className="access-denied">
                <h2>Access Denied</h2>
                <p>You don't have permission to access this page.</p>
                <p>Required role: {requiredRoles.join(' or ')}</p>
                <button onClick={() => window.history.back()}>Go Back</button>
                </div>
            );
        }
    }

    // User is authenticated and has required role/permissions, render the children
    return children;
};

export default ProtectedRoute;