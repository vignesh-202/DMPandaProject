import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthVerifyingScreen from '../components/ui/AuthVerifyingScreen';

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return <AuthVerifyingScreen text="Verifying session..." />;
  }

  if (isAuthenticated) {
    return <AuthVerifyingScreen text="Redirecting to dashboard..." />;
  }

  return <>{children}</>;
};

export default PublicRoute;