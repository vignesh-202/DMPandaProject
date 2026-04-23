import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

const AuthCallback: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      const secret = params.get('secret');
      const target = params.get('target');
      const redirectOrigin = params.get('redirect_origin');
      const isAdminBridge = target === 'admin' && !!redirectOrigin;

      if (userId && secret) {
        try {
          const url = new URL(`${import.meta.env.VITE_API_BASE_URL}/api/auth/google-callback`);
          url.searchParams.append('userId', userId);
          url.searchParams.append('secret', secret);
          url.searchParams.append('target', isAdminBridge ? 'admin' : 'frontend');

          const response = await fetch(url.toString(), {
            method: 'GET',
            credentials: 'include',
            headers: {
              'X-App-Context': isAdminBridge ? 'admin' : 'frontend'
            }
          });

          const data = await response.json();

          if (response.ok) {
            if (isAdminBridge && redirectOrigin) {
              window.location.replace(new URL('/', redirectOrigin).toString());
              return;
            }

            const sessionReady = await login();
            if (!sessionReady) {
              throw new Error('Google sign-in completed, but the session was not established. Please try again.');
            }
            navigate('/dashboard', { replace: true });
          } else {
            throw new Error(data.error || 'Failed to finalize Google login.');
          }
        } catch (err: any) {
          setError(err.message);
          if (isAdminBridge && redirectOrigin) {
            window.location.replace(new URL(`/login?error=oauth_failed&message=${encodeURIComponent(err.message)}`, redirectOrigin).toString());
            return;
          }
          navigate(`/login?error=oauth_failed&message=${encodeURIComponent(err.message)}`, { replace: true });
        }
      } else {
        if (isAdminBridge && redirectOrigin) {
          window.location.replace(new URL('/login?error=oauth_failed', redirectOrigin).toString());
          return;
        }
        navigate('/login?error=oauth_failed', { replace: true });
      }
    };

    handleAuth();
  }, [location, navigate, login]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-colors duration-500">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-500 dark:text-red-400">Authentication Failed</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return <LoadingOverlay />;
};

export default AuthCallback;
