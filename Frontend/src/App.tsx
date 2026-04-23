import React, { Suspense, useEffect } from 'react';
import { ThemeProvider, ThemeContext } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
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
const SuperProfilePublicPageLazy = React.lazy(() => import('./app/superprofile/page'));

const DeleteAccountGuidePageLazy = React.lazy(() => import('./app/delete-account-guide/page'));
const PasswordRecoveryPageLazy = React.lazy(() => import('./app/auth/recovery/page'));
const InstagramCallbackPageLazy = React.lazy(() => import('./app/auth/InstagramCallback'));

import Navbar from './components/ui/Navbar';
import Footer from './components/ui/Footer';
import DashboardLoading from './components/ui/DashboardLoading';
import ScrollToTop from './components/ui/ScrollToTop';

const SITE_ORIGIN = String(import.meta.env.VITE_PUBLIC_SITE_URL || 'https://dmpanda.com').replace(/\/+$/, '');
const ROUTE_TITLES: Record<string, string> = {
  '/': 'DM Panda',
  '/pricing': 'Pricing | DM Panda',
  '/about': 'About | DM Panda',
  '/features': 'Features | DM Panda',
  '/contact': 'Contact | DM Panda',
  '/disclaimer': 'Disclaimer | DM Panda',
  '/privacy': 'Privacy Policy | DM Panda',
  '/terms': 'Terms & Conditions | DM Panda',
  '/refund-policy': 'Refund Policy | DM Panda',
  '/delete-account-guide': 'Delete Account Guide | DM Panda',
  '/login': 'Login | DM Panda'
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const { setForceLightMode } = React.useContext(ThemeContext);
  const isPublicPage = !location.pathname?.startsWith('/dashboard');
  const isSuperProfilePage = location.pathname?.startsWith('/superprofile');

  useEffect(() => {
    // Public pages now respect browser theme (light/dark auto)
    // Only dashboard manages forced theme
    setForceLightMode(false);
  }, [isPublicPage, setForceLightMode]);

  useEffect(() => {
    const path = location.pathname || '/';
    const isDashboardLike = path.startsWith('/dashboard') || path.startsWith('/auth/');
    document.title = ROUTE_TITLES[path] || 'DM Panda';

    let robotsTag = document.querySelector('meta[name="robots"]');
    if (!robotsTag) {
      robotsTag = document.createElement('meta');
      robotsTag.setAttribute('name', 'robots');
      document.head.appendChild(robotsTag);
    }
    robotsTag.setAttribute('content', isDashboardLike ? 'noindex,nofollow' : 'index,follow');

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', `${SITE_ORIGIN}${path === '/' ? '' : path}`);
  }, [location.pathname]);

  return (
    <>
      {isPublicPage && !isSuperProfilePage && <Navbar />}
      <div className="page-transition">
        <Suspense fallback={isPublicPage ? null : <DashboardLoading />}>
          <Routes>
            <Route path="/" element={<HomePageLazy />} />
            <Route path="/dashboard/*" element={<ProtectedRoute><DashboardPageLazy /></ProtectedRoute>} />
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
            <Route path="/superprofile/:slug" element={<SuperProfilePublicPageLazy />} />
            <Route path="/login" element={<PublicRoute><LoginPageLazy /></PublicRoute>} />
            <Route path="/refund-policy" element={<RefundPolicyPageLazy />} />
            <Route path="/delete-account-guide" element={<DeleteAccountGuidePageLazy />} />
            <Route path="*" element={<NotFoundPageLazy />} />
          </Routes>
        </Suspense>
      </div>
      {isPublicPage && !isSuperProfilePage && <Footer />}
    </>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
