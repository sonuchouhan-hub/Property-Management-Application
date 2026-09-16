
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Suppress benign Vite environment HMR WebSocket errors/rejections from triggering overlays
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason) {
    const msg = typeof reason === 'string' ? reason : (reason.message || '');
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('ws://') || msg.includes('HMR')) {
      console.warn('Suppressed benign environment WebSocket rejection:', reason);
      event.preventDefault();
    }
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('ws://')) {
    console.warn('Suppressed benign environment WebSocket error:', msg);
    event.preventDefault();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Unregister any active service workers and clear caches to prevent stale React and bundle conflicts during development
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    let unregisteredAny = false;
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('[Service Worker] Force-unregistered stale service worker:', registration);
          unregisteredAny = true;
        }
      });
    }
    // If we unregistered a service worker, clear all caches and reload to load fresh assets
    if (unregisteredAny && 'caches' in window) {
      caches.keys().then((keys) => {
        Promise.all(keys.map(key => caches.delete(key))).then(() => {
          console.log('[Service Worker] Stale caches cleared. Reloading page.');
          window.location.reload();
        });
      });
    }
  });
}
