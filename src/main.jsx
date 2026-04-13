import React from 'react';
import ReactDOM from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);
