import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import './DeactivateAccountModal.css';

const CONFIRMATION_TEXT = "DELETE MY ACCOUNT";

const DeactivateAccountModal = ({ isOpen, onClose, onConfirmDeactivate, userEmail }) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isInputValid, setIsInputValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the input when the modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmationInput('');
      setIsInputValid(true);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle confirmation input change
  const handleInputChange = (e) => {
    setConfirmationInput(e.target.value);
    setIsInputValid(true); // Reset validation on input change
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (confirmationInput !== CONFIRMATION_TEXT) {
      setIsInputValid(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmDeactivate();
      // If we reach here, deactivation failed but didn't throw an error
      setIsSubmitting(false);
    } catch (error) {
      // Handle any errors
      setIsSubmitting(false);
    }
  };

  // If the modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="deactivate-modal-overlay" onClick={onClose}>
      <div className="deactivate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deactivate-modal-header">
          <AlertTriangle size={32} className="warning-icon" />
          <h2 className="deactivate-modal-title">Delete Account</h2>
        </div>
        
        <div className="deactivate-modal-content">
          <div className="warning-box">
            <p><strong>Warning:</strong> This action is permanent and cannot be undone. All your data will be permanently removed from our database.</p>
          </div>
          
          <p>
            <strong>Account being deleted:</strong> {userEmail || 'Not available'}
          </p>
          
          <div className="confirmation-input">
            <label htmlFor="confirmation">
              To confirm account deletion, please type "<strong>{CONFIRMATION_TEXT}</strong>" in the field below:
            </label>
            <input
              id="confirmation"
              type="text"
              value={confirmationInput}
              onChange={handleInputChange}
              placeholder={`Type "${CONFIRMATION_TEXT}" to confirm`}
              className={isInputValid ? '' : 'invalid'}
              disabled={isSubmitting}
            />
            {!isInputValid && (
              <p className="error-text" style={{ color: '#ef4444', marginTop: '5px' }}>
                Please type exactly "{CONFIRMATION_TEXT}" to confirm.
              </p>
            )}
          </div>
        </div>
        
        <div className="deactivate-modal-footer">
          <button 
            type="button"
            className="cancel-button" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="button"
            className="deactivate-button" 
            onClick={handleSubmit}
            disabled={confirmationInput !== CONFIRMATION_TEXT || isSubmitting}
          >
            {isSubmitting ? 'Deleting Account...' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeactivateAccountModal; 