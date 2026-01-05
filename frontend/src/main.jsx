import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App';
import './styles/global.css';

// Configure StatusBar for native iOS look
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }); // Dark text on light background
  StatusBar.setOverlaysWebView({ overlay: true }); // Content extends under status bar
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
