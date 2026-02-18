import React, { Suspense, useEffect } from 'react';
import { ThemeProvider, ThemeContext } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './app/dashboard/ProtectedRoute';
import PublicRoute from './app/PublicRoute';
import AuthCallback from './app/auth/AuthCallback';
const DashboardPageLazy = React.lazy(() => import('./app/dashboard/page'));
const HomePageLazy = React.lazy(() => import('./app/home/page'));
const PricingPageLazy = React.lazy(() => import('./app/pricing/page'));
const AboutPageLazy = React.lazy(() => import('./app/about/page'));
const ContactPageLazy = React.lazy(() => import('./app/contact/page'));
const FeaturesPageLazy = React.lazy(() => import('./app/features/page'));
const DisclaimerPageLazy = React.lazy(() => import('./app/disclaimer/page'));
const PrivacyPageLazy = React.lazy(() => import('./app/privacy/page'));
const TermsPageLazy = React.lazy(() => import('./app/terms/page'));
const LoginPageLazy = React.lazy(() => import('./app/login/page'));
const RefundPolicyPageLazy = React.lazy(() => import('./app/refund-policy/page'));
const NotFoundPageLazy = React.lazy(() => import('./app/not-found'));
const VerifyEmailPageLazy = React.lazy(() => import('./app/auth/verify/page'));
const AffiliatePageLazy = React.lazy(() => import('./app/affiliate/page'));

const DeleteAccountGuidePageLazy = React.lazy(() => import('./app/delete-account-guide/page'));
const PasswordRecoveryPageLazy = React.lazy(() => import('./app/auth/recovery/page'));
const InstagramCallbackPageLazy = React.lazy(() => import('./app/auth/InstagramCallback'));

import Navbar from './components/ui/Navbar';
import Footer from './components/ui/Footer';
import DashboardLoading from './components/ui/DashboardLoading';
import ScrollToTop from './components/ui/ScrollToTop';
const AppContent: React.FC = () => {
  const location = useLocation();
  const { setForceLightMode } = React.useContext(ThemeContext);
  const isPublicPage = !location.pathname?.startsWith('/dashboard');

  // Enforce light mode on public pages
  useEffect(() => {
    setForceLightMode(isPublicPage);
  }, [isPublicPage, setForceLightMode]);

  return (
    <ThemeProvider>
      {isPublicPage && <Navbar />}
      <div className="page-transition">
        <Suspense fallback={isPublicPage ? null : <DashboardLoading />}>
          <Routes>
            <Route path="/" element={<HomePageLazy />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPageLazy /></ProtectedRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/verify" element={<VerifyEmailPageLazy />} />
            <Route path="/auth/recovery" element={<PasswordRecoveryPageLazy />} />
            <Route path="/auth/ig-callback" element={<InstagramCallbackPageLazy />} />
            <Route path="/pricing" element={<PricingPageLazy />} />
            <Route path="/about" element={<AboutPageLazy />} />
            <Route path="/features" element={<FeaturesPageLazy />} />
            <Route path="/contact" element={<ContactPageLazy />} />
            <Route path="/disclaimer" element={<DisclaimerPageLazy />} />
            <Route path="/privacy" element={<PrivacyPageLazy />} />
            <Route path="/terms" element={<TermsPageLazy />} />
            <Route path="/affiliate" element={<AffiliatePageLazy />} />
            <Route path="/login" element={<PublicRoute><LoginPageLazy /></PublicRoute>} />
            <Route path="/refund-policy" element={<RefundPolicyPageLazy />} />
            <Route path="/delete-account-guide" element={<DeleteAccountGuidePageLazy />} />
            <Route path="*" element={<NotFoundPageLazy />} />
          </Routes>
        </Suspense>
      </div>
      {isPublicPage && <Footer />}
    </ThemeProvider>
  );
};
function App() {
  return (
    <Router>
      <ScrollToTop />
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
