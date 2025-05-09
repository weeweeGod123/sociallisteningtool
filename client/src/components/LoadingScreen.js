import React, { useState, useEffect } from 'react';
import '../App.css';

/**
 * A reusable loading screen component with fade-in and fade-out effects
 * @param {Object} props 
 * @param {boolean} props.isLoading - Whether the component should be visible
 * @param {string} props.message - Optional custom message to display
 * @param {number} props.delay - Optional delay before showing in ms (prevents flash)
 * @returns {JSX.Element}
 */
const LoadingScreen = ({ isLoading, message = 'Loading...', delay = 200 }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [opacity, setOpacity] = useState(0);
  
  useEffect(() => {
    let showTimer;
    let fadeTimer;
    
    if (isLoading) {
      // Delay showing the loading screen to prevent flash
      showTimer = setTimeout(() => {
        setShouldRender(true);
        // Fade in after render
        fadeTimer = setTimeout(() => {
          setOpacity(1);
        }, 10);
      }, delay);
    } else {
      // Fade out first
      setOpacity(0);
      // Then remove from DOM after transition
      fadeTimer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match the transition duration in CSS
    }
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
    };
  }, [isLoading, delay]);
  
  if (!shouldRender) return null;
  
  return (
    <div className="loading-screen" style={{ opacity }}>
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingScreen; 