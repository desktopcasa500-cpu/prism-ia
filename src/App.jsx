import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';
import { useAuth } from './lib/auth.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="loading-mark">P</div></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="loading-mark">P</div></div>;
  return user ? <Navigate to="/chat" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
