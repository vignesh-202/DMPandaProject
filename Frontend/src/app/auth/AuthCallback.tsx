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

      if (userId && secret) {
        try {
          const url = new URL(`${import.meta.env.VITE_API_BASE_URL}/api/auth/google-callback`);
          url.searchParams.append('userId', userId);
          url.searchParams.append('secret', secret);

          const response = await fetch(url.toString(), {
            method: 'GET',
          });

          const data = await response.json();

          if (response.ok) {
            localStorage.setItem('token', data.token);
            await login();
            navigate('/dashboard', { replace: true });
          } else {
            throw new Error(data.error || 'Failed to finalize Google login.');
          }
        } catch (err: any) {
          setError(err.message);
          navigate(`/login?error=oauth_failed&message=${encodeURIComponent(err.message)}`, { replace: true });
        }
      } else {
        // Handle cases where secret/userId are missing
        navigate('/login?error=oauth_failed', { replace: true });
      }
    };

    handleAuth();
  }, [location, navigate, login]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return <LoadingOverlay />;
};

export default AuthCallback;