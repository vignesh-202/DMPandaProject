import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import LoadingOverlay from '../../../components/ui/LoadingOverlay';

const VerifyEmailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleVerification = async () => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      const secret = params.get('secret');

      if (userId && secret) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/verify-callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, secret }),
          });

          const data = await response.json();

          if (response.ok) {
            setMessage('Verification successful! Logging you in...');
            localStorage.setItem('token', data.token);
            await login();
            navigate('/dashboard', { replace: true });
          } else {
            throw new Error(data.error || 'Failed to verify email.');
          }
        } catch (err: any) {
          setError(err.message);
          navigate(`/login?error=verification_failed&message=${encodeURIComponent(err.message)}`, { replace: true });
        }
      } else {
        setError('Invalid verification link. Missing required parameters.');
        navigate('/login?error=verification_failed', { replace: true });
      }
    };

    handleVerification();
  }, [location, navigate, login]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-500 text-center">
            <h1 className="text-xl font-bold">Verification Failed</h1>
            <p>{error}</p>
        </div>
      </div>
    );
  }

  return <LoadingOverlay message={message} />;
};

export default VerifyEmailPage;