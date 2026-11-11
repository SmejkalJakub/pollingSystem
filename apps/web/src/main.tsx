import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/inter';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Application root is missing.');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
