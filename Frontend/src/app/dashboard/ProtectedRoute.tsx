import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingProvider, useLoading } from '../../contexts/LoadingContext';
import DashboardLoading from '../../components/ui/DashboardLoading';
import OnboardingFlow from './OnboardingFlow';

const ProtectedRouteContent = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isVerified, isLoading: isAuthLoading, hasPassword, hasLinkedInstagram } = useAuth();
  const { setIsLoading } = useLoading();

  useEffect(() => {
    if (!isAuthLoading) {
      setIsLoading(false);
    }
  }, [isAuthLoading, setIsLoading]);

  if (isAuthLoading) {
    return <DashboardLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // User must complete these before accessing dashboard:
  // 1. Set password (for Google OAuth users)
  // 2. Verify email (for email signup users)
  // Instagram linking is now optional for dashboard access but locks some features.
  const needsOnboarding = hasPassword === false || !isVerified;

  if (needsOnboarding) {
    return <OnboardingFlow />;
  }

  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  return (
    <LoadingProvider>
      <ProtectedRouteContent>{children}</ProtectedRouteContent>
    </LoadingProvider>
  );
};

export default ProtectedRoute;