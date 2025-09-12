import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/src/App.jsx';
// Tailwind compiled stylesheet (replaces CDN script)
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

