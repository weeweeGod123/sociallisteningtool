import React from 'react';
import { useFlashMessages, MESSAGE_TYPES } from '../contexts/FlashMessageContext';
import { AlertCircle, X } from 'lucide-react';
import './FlashMessage.css';

const FlashMessage = () => {
  const { messages, removeMessage } = useFlashMessages();

  // Return early if there are no messages
  if (!messages.length) return null;

  return (
    <div className="flash-messages-container">
      {messages.map((message) => (
        <div 
          key={message.id} 
          className={`flash-message flash-message-${message.type} ${message.persistent ? 'persistent' : ''}`}
        >
          <AlertCircle size={20} />
          <span>{message.text}</span>
          <button 
            className="flash-message-close" 
            onClick={() => removeMessage(message.id)}
            aria-label="Close message"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default FlashMessage; 