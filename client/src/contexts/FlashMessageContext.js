import React, { createContext, useState, useContext, useCallback } from 'react';

// Create context for flash messages
const FlashMessageContext = createContext();

// Message types
export const MESSAGE_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

export function FlashMessageProvider({ children }) {
  const [messages, setMessages] = useState([]);

  // Generate a unique ID for each message
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add a new message
  const addMessage = useCallback((text, type = MESSAGE_TYPES.INFO, timeout = 3000, persistent = false) => {
    const id = generateId();
    
    // Add the new message to the state
    setMessages(prev => [...prev, { id, text, type, persistent }]);
    
    // Automatically remove the message after timeout unless it's persistent
    if (timeout > 0 && !persistent) {
      setTimeout(() => {
        removeMessage(id);
      }, timeout);
    }
    
    return id;
  }, []);

  // Remove a message by ID
  const removeMessage = useCallback((id) => {
    setMessages(prev => prev.filter(message => message.id !== id));
  }, []);

  // Helper functions for specific message types
  const success = useCallback((text, timeout = 3000, persistent = false) => 
    addMessage(text, MESSAGE_TYPES.SUCCESS, timeout, persistent), [addMessage]);
  
  const error = useCallback((text, timeout = 3000, persistent = false) => 
    addMessage(text, MESSAGE_TYPES.ERROR, timeout, persistent), [addMessage]);
  
  const info = useCallback((text, timeout = 3000, persistent = false) => 
    addMessage(text, MESSAGE_TYPES.INFO, timeout, persistent), [addMessage]);
  
  const warning = useCallback((text, timeout = 3000, persistent = false) => 
    addMessage(text, MESSAGE_TYPES.WARNING, timeout, persistent), [addMessage]);

  // Create persistent versions of message functions
  const persistentSuccess = useCallback((text) => 
    success(text, 0, true), [success]);

  const persistentError = useCallback((text) => 
    error(text, 0, true), [error]);

  const persistentInfo = useCallback((text) => 
    info(text, 0, true), [info]);

  const persistentWarning = useCallback((text) => 
    warning(text, 0, true), [warning]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Context value object
  const contextValue = {
    messages,
    addMessage,
    removeMessage,
    success,
    error,
    info,
    warning,
    persistentSuccess,
    persistentError,
    persistentInfo,
    persistentWarning,
    clearMessages
  };

  return (
    <FlashMessageContext.Provider value={contextValue}>
      {children}
    </FlashMessageContext.Provider>
  );
}

// Hook to use flash message context
export function useFlashMessages() {
  const context = useContext(FlashMessageContext);
  
  if (!context) {
    throw new Error('useFlashMessages must be used within a FlashMessageProvider');
  }
  
  return context;
}

export default FlashMessageContext; 