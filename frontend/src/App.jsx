import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InvoicePage from './pages/InvoicePage';
import TrackerPage from './pages/TrackerPage';
import PriorityPage from './pages/PriorityPage';
import ReportsPage from './pages/ReportsPage';
import CustomersPage from './pages/CustomersPage';
import LoginPage from './pages/LoginPage';
import CourierPage from './pages/CourierPage';
import PriorityRecommendationPage from './pages/PriorityRecommendationPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ResearchShowcasePage from './pages/ResearchShowcasePage';
import { AUTHENTICATED_ROLES, PRIVILEGED_ROLES, getDefaultPathForUser, getStoredUser } from './utils/auth';

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated, user }) => {
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const RoleRoute = ({ children, user, allowedRoles = AUTHENTICATED_ROLES }) => {
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to={getDefaultPathForUser(user)} replace />;
  }
  return children;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists on initial load
    const token = localStorage.getItem('token');
    const storedUser = getStoredUser();
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(storedUser);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, user) => {
    setIsAuthenticated(true);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return <div>Memuat aplikasi...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to={getDefaultPathForUser(user)} replace /> : <LoginPage onLogin={handleLogin} />
        } />
        
        <Route path="/*" element={
          <ProtectedRoute isAuthenticated={isAuthenticated} user={user}>
            <div className="app-layout">
              <Sidebar onLogout={handleLogout} />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <Dashboard />
                    </RoleRoute>
                  } />
                  <Route path="/invoices" element={
                    <RoleRoute user={user}>
                      <InvoicePage />
                    </RoleRoute>
                  } />
                  <Route path="/tracker" element={
                    <RoleRoute user={user}>
                      <TrackerPage />
                    </RoleRoute>
                  } />
                  <Route path="/courier" element={
                    <RoleRoute user={user}>
                      <CourierPage />
                    </RoleRoute>
                  } />
                  <Route path="/priority" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <PriorityPage />
                    </RoleRoute>
                  } />
                  <Route path="/recommendation" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <PriorityRecommendationPage />
                    </RoleRoute>
                  } />
                  <Route path="/research-showcase" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <ResearchShowcasePage />
                    </RoleRoute>
                  } />
                  <Route path="/analytics" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <AnalyticsPage />
                    </RoleRoute>
                  } />
                  <Route path="/reports" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <ReportsPage />
                    </RoleRoute>
                  } />
                  <Route path="/customers" element={
                    <RoleRoute user={user} allowedRoles={PRIVILEGED_ROLES}>
                      <CustomersPage />
                    </RoleRoute>
                  } />
                  <Route path="*" element={<Navigate to={getDefaultPathForUser(user)} replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
