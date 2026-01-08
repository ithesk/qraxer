import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App';
import './styles/global.css';

// Global error handler to catch unhandled errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error });
  // Store error in localStorage for debugging
  try {
    const errors = JSON.parse(localStorage.getItem('qraxer_errors') || '[]');
    errors.unshift({
      message,
      source,
      lineno,
      colno,
      stack: error?.stack,
      time: new Date().toISOString()
    });
    localStorage.setItem('qraxer_errors', JSON.stringify(errors.slice(0, 10)));
  } catch (e) {
    // ignore
  }
  return false;
};

// Unhandled promise rejection handler
window.onunhandledrejection = function(event) {
  console.error('[UNHANDLED REJECTION]', event.reason);
  try {
    const errors = JSON.parse(localStorage.getItem('qraxer_errors') || '[]');
    errors.unshift({
      message: 'Unhandled Promise Rejection',
      reason: String(event.reason),
      stack: event.reason?.stack,
      time: new Date().toISOString()
    });
    localStorage.setItem('qraxer_errors', JSON.stringify(errors.slice(0, 10)));
  } catch (e) {
    // ignore
  }
};

console.log('[MAIN] Starting QRaxer app...');
console.log('[MAIN] Platform:', Capacitor.getPlatform());
console.log('[MAIN] isNative:', Capacitor.isNativePlatform());

// Configure StatusBar for native iOS look
if (Capacitor.isNativePlatform()) {
  console.log('[MAIN] Configuring StatusBar...');
  StatusBar.setStyle({ style: Style.Dark }).catch(e => console.warn('[MAIN] StatusBar.setStyle error:', e));
  StatusBar.setOverlaysWebView({ overlay: true }).catch(e => console.warn('[MAIN] StatusBar.setOverlaysWebView error:', e));
}

console.log('[MAIN] Rendering React app...');

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('[MAIN] React render called successfully');
} catch (e) {
  console.error('[MAIN] Error rendering React app:', e);
  // Show error on screen
  document.body.innerHTML = `<div style="padding: 20px; color: red;"><h1>Error</h1><pre>${e.message}\n${e.stack}</pre></div>`;
}
