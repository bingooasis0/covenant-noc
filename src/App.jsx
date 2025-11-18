import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import NOCDashboardV2 from './components/NOCDashboardV2';
import MerakiDashboard from './components/MerakiDashboard';
import CardDesignShowcase from './components/CardDesignShowcase';
import AuditLogPage from './components/AuditLogPage';
import Login from './components/Login';

const ProtectedRoute = ({ children }) => {
  const { user, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#f3f4f6'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const DashboardRoutes = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleShowcaseBack = () => {
    navigate('/dashboard/grid', { replace: true });
  };

  const handleShowcaseOpen = () => {
    navigate('/dashboard/showcase');
  };

  const handleAuditLogBack = () => {
    navigate('/dashboard/grid', { replace: true });
  };

  const handleAuditLogOpen = () => {
    navigate('/dashboard/audit-log');
  };

  return (
    <Routes>
      <Route
        path="showcase"
        element={<CardDesignShowcase onBack={handleShowcaseBack} />}
      />
      <Route
        path="audit-log"
        element={<AuditLogPage onBack={handleAuditLogBack} />}
      />
      <Route
        path="meraki"
        element={<MerakiDashboard user={user} onLogout={onLogout} />}
      />
      <Route
        path=":mode"
        element={(
          <NOCDashboardV2
            user={user}
            onShowCardShowcase={handleShowcaseOpen}
            onShowAuditLog={handleAuditLogOpen}
          />
        )}
      />
      <Route index element={<Navigate to="grid" replace />} />
      <Route path="*" element={<Navigate to="grid" replace />} />
    </Routes>
  );
};

function App() {
  const { user, logout } = useAuth();

  // Add elegant smooth scrolling CSS
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const existing = document.getElementById('global-smooth-scroll');
    let styleEl = existing;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'global-smooth-scroll';
      styleEl.textContent = `
        html {
          scroll-behavior: smooth;
        }

        body, #root {
          overscroll-behavior-y: contain;
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: transparent;
        }

        *::-webkit-scrollbar-thumb {
          background-color: rgba(155, 155, 155, 0.5);
          border-radius: 20px;
          border: transparent;
        }

        *::-webkit-scrollbar-thumb:hover {
          background-color: rgba(155, 155, 155, 0.7);
        }
      `;
      document.head.appendChild(styleEl);
    }

    return () => {
      if (!existing && styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);

  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardRoutes user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/dashboard/grid" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/dashboard/grid" replace />} />
      </Routes>
    </>
  );
}

export default App;
