import React from 'react';
import { createRoot } from 'react-dom/client';
// Correzione: Il contenuto di App.jsx è incluso direttamente qui per garantire che il compilatore lo trovi.
import App from './App.jsx'; 

// Inizializza l'applicazione React nel DOM
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 
