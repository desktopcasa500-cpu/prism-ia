import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';
import Studio from './pages/Studio.jsx';
import { useAuth } from './lib/auth.jsx';

function LoadingScreen() {
  return (
    <div className="app-loading" role="status" aria-label="Carregando">
      <div className="loading-wordmark">PRISM</div>
      <div className="loading-line" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/chat" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/studio" element={<PrivateRoute><Studio /></PrivateRoute>} />
      <Route path="/workspace" element={<Navigate to="/studio" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
