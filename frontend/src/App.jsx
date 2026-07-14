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

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists on initial load
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, user) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div>Memuat aplikasi...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />
        } />
        
        <Route path="/*" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <div className="app-layout">
              <Sidebar onLogout={handleLogout} />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/invoices" element={<InvoicePage />} />
                  <Route path="/tracker" element={<TrackerPage />} />
                  <Route path="/courier" element={<CourierPage />} />
                  <Route path="/priority" element={<PriorityPage />} />
                  <Route path="/recommendation" element={<PriorityRecommendationPage />} />
                  <Route path="/research-showcase" element={<ResearchShowcasePage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
