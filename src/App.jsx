import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import PrismSite from './PrismSite.jsx';

function LoadingScreen() {
  return <div className="app-loading"><span>PRISM</span><i /></div>;
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
  return <Routes>
    <Route path="/" element={<PrismSite page="landing" />} />
    <Route path="/informacoes" element={<PrismSite page="info" />} />
    <Route path="/informacoes/:id" element={<PrismSite page="term-detail" />} />
    <Route path="/modelos" element={<PrismSite page="models" />} />
    <Route path="/modelos/:id" element={<PrismSite page="model-detail" />} />
    <Route path="/termos" element={<PrismSite page="terms" />} />
    <Route path="/termos/:topic" element={<PrismSite page="term-detail" />} />
    <Route path="/login" element={<PublicRoute><PrismSite page="login" /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><PrismSite page="register" /></PublicRoute>} />
    <Route path="/chat" element={<PrivateRoute><PrismSite page="chat" /></PrivateRoute>} />
    <Route path="/codex" element={<PrivateRoute><PrismSite page="codex" /></PrivateRoute>} />
    <Route path="/studio" element={<PrivateRoute><PrismSite page="codex" /></PrivateRoute>} />
    <Route path="/configuracoes" element={<PrivateRoute><PrismSite page="settings" /></PrivateRoute>} />
    <Route path="/workspace" element={<Navigate to="/codex" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
