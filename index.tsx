import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Standard registration using relative path
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('AxiomOS PWA: Service Worker Active', reg.scope);
      })
      .catch(err => {
        // On mobile browsers, origin or security restrictions might trigger. 
        // We log it as info to avoid cluttering the production logs.
        if (err.name === 'SecurityError') {
          console.info('AxiomOS PWA: Browser origin policy deferred registration.');
        } else {
          console.warn('AxiomOS PWA: Registration deferred:', err.message);
        }
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);