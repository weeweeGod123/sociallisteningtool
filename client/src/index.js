import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Suppress ResizeObserver loop errors in development
if (process.env.NODE_ENV === 'development') {
  const suppressedErrors = [
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded'
  ];
  const realConsoleError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && suppressedErrors.some(e => args[0].includes(e))) {
      return;
    }
    realConsoleError(...args);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);