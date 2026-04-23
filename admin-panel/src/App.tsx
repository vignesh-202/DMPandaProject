import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { AnalyticsPage } from './pages/Analytics';
import { AutomationsPage } from './pages/Automations';
import { CouponsPage } from './pages/Coupons';
import { EmailCampaignsPage } from './pages/EmailCampaigns';
import { SettingsPage } from './pages/Settings';
import { UsersPage } from './pages/Users';
import { PricingPage } from './pages/Pricing';
import AdminLoadingState from './components/AdminLoadingState';

const AdminPublicRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <AdminLoadingState fullScreen title="Checking your session" description="Preparing the admin workspace and verifying access." />;
  }

  if (user && isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<AdminPublicRoute><Login /></AdminPublicRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/users/:userId" element={<UsersPage />} />
                <Route path="/users/:userId/edit" element={<UsersPage />} />
                <Route path="/automations" element={<AutomationsPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/coupons" element={<CouponsPage />} />
                <Route path="/coupons/create" element={<CouponsPage />} />
                <Route path="/coupons/:couponId/edit" element={<CouponsPage />} />
                <Route path="/email-campaigns" element={<EmailCampaignsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
