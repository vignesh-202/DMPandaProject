import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthVerifyingScreen from '../components/ui/AuthVerifyingScreen';

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, authHint, isLoading } = useAuth();

  if (isAuthenticated || authHint) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return <AuthVerifyingScreen text="Verifying session..." />;
  }

  return <>{children}</>;
};

export default PublicRoute;
