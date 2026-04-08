import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/error-boundary';
import './app/globals.css';

// Global error safety net — prevents unhandled rejections from crashing the app
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[Global] Unhandled promise rejection:', e.reason);
    e.preventDefault();
  });
  window.addEventListener('error', (e) => {
    console.warn('[Global] Window error:', e.error ?? e.message);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
