// Modal.js
import React, { useRef, useEffect } from 'react';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, children, requireScroll, onScrolledToEnd }) {
  const contentRef = useRef();

  useEffect(() => {
    if (!requireScroll) return;

    const checkScroll = () => {
      const el = contentRef.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
        if (onScrolledToEnd) {
          onScrolledToEnd();
        }
      }
    };

    const current = contentRef.current;
    if (current) current.addEventListener('scroll', checkScroll);

    return () => current?.removeEventListener('scroll', checkScroll);
  }, [requireScroll, onScrolledToEnd]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body" ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
