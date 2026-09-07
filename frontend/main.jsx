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
import './prism-chat.css';
import './prism-chat-v2.css';
import './prism-code-artifacts.css';
import './provider-status.css';
import './chat-home-redesign.css';
import './conversation-quality.css';
import './auth-premium.css';
import './settings.css';
import './pixel-refinement.css';
import './prism-identity.css';
import './prism-original-pages.css';
import './prism-polish.css';
import './pages/prism-codex-final.css';
import './pages/prism-codex-v2.css';
import './codex-redesign.css';
import './prism-logo-overrides.css';
import './taff-presentation-v2.css';
import './reference-experience.css';
import './reference-experience-v4.css';
import './reference-experience-v5.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
