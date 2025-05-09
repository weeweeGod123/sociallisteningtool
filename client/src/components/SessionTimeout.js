// client/src/components/SessionTimeout.js
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';
import './SessionTimeout.css';

// Default warning time before session expires (3 minutes)
const WARNING_TIME = 5 * 60 * 1000;
// Default check interval (1 minute)
const CHECK_INTERVAL = 5 * 60 * 1000;
// Default session timeout (2 hours)
const SESSION_TIMEOUT =2 * 60 * 60 * 1000;

const SessionTimeout = () => {
    const { user, lastActivity, logout, updateActivity } = useSession();
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [intervalId, setIntervalId] = useState(null);

    // Calculate time left in session
    const calculateTimeLeft = useCallback(() => {
        if (!user) return 0;
        
        const now = Date.now();
        const inactiveTime = now - lastActivity;
        const remaining = Math.max(0, SESSION_TIMEOUT - inactiveTime);
        
        return remaining;
    }, [user, lastActivity]);

    // Check for session timeout
    const checkSessionTimeout = useCallback(() => {
        if (!user) return;
        
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
        
        // Show warning if session will expire soon
        if (remaining > 0 && remaining <= WARNING_TIME) 
        {
            setShowWarning(true);
        } 
        else 
        {
            setShowWarning(false);
        }
        
        // If session has expired, log out
        if (remaining === 0) 
        {
            logout();
            setShowWarning(false);
        }
    }, [user, calculateTimeLeft, logout]);

    // Start checking for session timeout when user is logged in
    useEffect(() => {
        if (user)
        {
            // Clear any existing interval
            if (intervalId) 
            {
                clearInterval(intervalId);
            }
            
            // Set up new interval
            const newIntervalId = setInterval(() => {
                checkSessionTimeout();
            }, CHECK_INTERVAL);
            
            setIntervalId(newIntervalId);
            
            // Initial check
            checkSessionTimeout();
            
            // Clean up on unmount
            return () => {
                clearInterval(newIntervalId);
            };
        } 
        else 
        {
            // Clear interval when user logs out
            if (intervalId) {
                clearInterval(intervalId);
                setIntervalId(null);
            }
        }
    }, [user, checkSessionTimeout, intervalId]);
    
    // Format time remaining as mm:ss
    const formatTimeLeft = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Handle continue session button click
    const handleContinue = () => {
        updateActivity();
        setShowWarning(false);
    };
    
    // If user is not logged in, don't render anything
    if (!user) 
    {
        return null;
    }
    
    return (
        <>
        {showWarning && (
            <div className="session-timeout-modal">
            <div className="session-timeout-content">
                <h3>Your session is about to expire</h3>
                <p>Due to inactivity, your session will expire in:</p>
                <div className="session-timeout-timer">{formatTimeLeft(timeLeft)}</div>
                <p>Do you want to continue your session?</p>
                <div className="session-timeout-actions">
                <button 
                    className="session-timeout-button continue"
                    onClick={handleContinue}
                >
                    Continue Session
                </button>
                <button 
                    className="session-timeout-button logout"
                    onClick={logout}
                >
                    Logout Now
                </button>
                </div>
            </div>
            </div>
        )}
        </>
    );
};

export default SessionTimeout;