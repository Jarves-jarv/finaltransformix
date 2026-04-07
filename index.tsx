import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Import Tailwind CSS — processed by PostCSS at build time
// Replaces the 1.2MB Tailwind CDN runtime engine with ~15KB purged CSS
import './index.css';

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
