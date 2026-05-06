import { Suspense, lazy, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import AdminLoadingState from './components/AdminLoadingState';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then((module) => ({ default: module.AuthCallback })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const AnalyticsPage = lazy(() => import('./pages/Analytics').then((module) => ({ default: module.AnalyticsPage })));
const AutomationsPage = lazy(() => import('./pages/Automations').then((module) => ({ default: module.AutomationsPage })));
const CouponsPage = lazy(() => import('./pages/Coupons').then((module) => ({ default: module.CouponsPage })));
const EmailCampaignsPage = lazy(() => import('./pages/EmailCampaigns').then((module) => ({ default: module.EmailCampaignsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazy(() => import('./pages/Users').then((module) => ({ default: module.UsersPage })));
const PricingPage = lazy(() => import('./pages/Pricing').then((module) => ({ default: module.PricingPage })));

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
          <Suspense fallback={<AdminLoadingState fullScreen title="Loading admin panel" description="Opening the next workspace section..." />}>
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
          </Suspense>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
