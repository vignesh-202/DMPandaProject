import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';

const VerifyEmailChangePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Verifying your email change...');

  useEffect(() => {
    const handleEmailChangeVerification = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        setError('Invalid verification link. Missing token parameter.');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      try {
        const response = await fetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/verify-email-change`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          logout(); // Clear all frontend auth state (Hint, user, etc.)
          setMessage('Email change verified successfully! Redirecting to login...');
          setTimeout(() => {
            navigate(`/login?success=email_changed&message=${encodeURIComponent(data.message || 'Email changed successfully. Please log in with your new email.')}`, { replace: true });
          }, 2000);
        } else {
          throw new Error(data.error || 'Failed to verify email change.');
        }
      } catch (err: any) {
        setError(err.message);
        setTimeout(() => {
          navigate(`/login?popup_reason=email_change_failed&message=${encodeURIComponent(err.message)}`, { replace: true });
        }, 4000);
      }
    };

    handleEmailChangeVerification();
  }, [location, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-colors duration-500">
        <div className="text-center p-6 bg-card border border-border rounded-3xl max-w-md shadow-xl animate-fadeIn">
          <h1 className="text-xl font-bold text-red-500 dark:text-red-400">Verification Failed</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
          <p className="text-xs text-muted-foreground mt-4">Redirecting you to the login page...</p>
        </div>
      </div>
    );
  }

  return <LoadingOverlay message={message} />;
};

export default VerifyEmailChangePage;
