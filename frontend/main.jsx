import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import './lib/codex-autostart.js';
import './styles.css';
import './studio.css';
import './studio-fixes.css';
import './studio-pixel.css';
import './studio-overrides.css';
import './pixel-landing.css';
import './editorial-pages.css';
import './prism-chat.css';
import './auth-premium.css';
import './settings.css';
import './pixel-refinement.css';
import './codex.css';
import './prism-identity.css';
import './brutal-codex.css';
import './brutalist-chat-codex.css';
import './prism-original-pages.css';
import './chat-codex-polish.css';
import './codex-intro.css';
import './codex-rebuild.css';
import './prism-polish.css';
import './prism-codex-edit-v2.css';
import './chat-codex-v3.css';
import './prism-codex-sequence.css';
import './prism-production-polish.css';
import './prism-codex-intro-v3.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
