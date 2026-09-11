import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import './styles.css';
import './studio.css';
import './studio-fixes.css';
import './studio-pixel.css';
import './studio-overrides.css';
import './pixel-landing.css';
import './editorial-pages.css';
import './provider-status.css';
import './auth-premium.css';
import './settings.css';
import './pixel-refinement.css';
import './prism-original-pages.css';
import './prism-polish.css';
import './taff-presentation-v2.css';
import './settings-simple-v2.css';
import './release-hotfix.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
