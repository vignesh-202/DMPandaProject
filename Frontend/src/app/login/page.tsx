import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Check, X, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthIndicator from '../../components/ui/PasswordStrength';

const LoginPage: React.FC = () => {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // UI state
  const [isLoginView, setIsLoginView] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const popupReason = urlParams.get('popup_reason');
    const message = urlParams.get('message');

    if (popupReason) {
      if (message) {
        alert(message);
      } else if (popupReason === 'not_logged_in') {
        alert('You must be logged in to view this page.');
      } else if (popupReason === 'user_banned') {
        alert('Your account has been banned.');
      } else if (popupReason === 'user_deleted') {
        alert('Your account has been deleted.');
      } else if (popupReason === 'invalid_session') {
        alert('Your session is invalid. Please log in again.');
      } else if (popupReason === 'oauth_failed') {
        alert('Google login failed. Please try again.');
      } else if (popupReason === 'session_creation_failed') {
        alert('Failed to create user session after Google login. Please try again.');
      } else if (popupReason === 'auth_error') {
        alert('An unexpected authentication error occurred. Please try again.');
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/google`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to get Google login URL.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start Google sign-in. Please try again.');
      setIsSubmitting(false);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!isLoginView) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const url = isLoginView
      ? `${import.meta.env.VITE_API_BASE_URL}/api/login`
      : `${import.meta.env.VITE_API_BASE_URL}/api/register`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: isLoginView ? undefined : name, isLoginView }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLoginView) {
          localStorage.setItem('token', data.token);
          await login();
          navigate('/dashboard');
        } else {
          // This is the registration view
          setSuccessMessage(data.message || 'Registration successful. Please check your email to verify your account.');
        }
      } else {
        throw new Error(data.error || `Failed to ${isLoginView ? 'login' : 'register'}.`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl rounded-2xl flex overflow-hidden">
        {/* Left Side - Promotional Content */}
        <div className="hidden md:flex w-1/2 bg-black text-white p-12 flex-col justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Automate Your DMs, Grow Your Brand
          </h2>
          <p className="text-gray-300 mb-8">
            Join thousands of creators and businesses who use DM Panda to save time and boost engagement on Instagram.
          </p>
          <ul className="space-y-4">
            <li className="flex items-center">
              <span className="text-green-400 mr-3">✓</span>
              <span>Automated Replies</span>
            </li>
            <li className="flex items-center">
              <span className="text-green-400 mr-3">✓</span>
              <span>Audience Segmentation</span>
            </li>
            <li className="flex items-center">
              <span className="text-green-400 mr-3">✓</span>
              <span>Performance Analytics</span>
            </li>
          </ul>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="text-center w-full">
            <img src="/images/logo.png" alt="DM Panda Logo" className="mx-auto mb-4" style={{ maxHeight: '70px' }} />
            <h2 className="text-2xl font-bold mb-2 text-gray-900">{isLoginView ? 'Welcome Back!' : 'Create Your Account'}</h2>
            <p className="text-gray-600 mb-6">{isLoginView ? 'Sign in to continue to your dashboard.' : 'Get started with DM Panda today.'}</p>

            {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</p>}
            {successMessage && <p className="bg-green-100 text-green-700 p-3 rounded-md mb-4">{successMessage}</p>}

            <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
              {!isLoginView && (
                <Input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full text-black" />
              )}
              <Input id="email-input" type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full text-black" />

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full text-black pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {!isLoginView && (
                <>
                  <PasswordStrengthIndicator password={password} />
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full text-black pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {confirmPassword && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 mr-1">
                        {password === confirmPassword ? (
                          <Check size={18} className="text-green-500" />
                        ) : (
                          <X size={18} className="text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {isLoginView && (
                <div className="text-right -mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!email || !isValidEmail(email)) {
                        setError('Please enter a valid email address first.');
                        return;
                      }
                      setIsSubmitting(true);
                      setError(null);
                      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/forgot-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                      })
                        .then(res => res.json())
                        .then(data => {
                          if (data.message) {
                            setSuccessMessage('Password reset link sent! Check your email.');
                          } else {
                            setError(data.error || 'Failed to send reset email.');
                          }
                        })
                        .catch(() => setError('An error occurred.'))
                        .finally(() => setIsSubmitting(false));
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800 transition-colors" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoginView ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full group relative flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 ease-in-out overflow-hidden disabled:opacity-50"
            >
              <span className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-instagram-start via-instagram-pink to-instagram-yellow opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
              <span className="relative flex items-center">
                <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C43.021,36.226,44,30.425,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                </svg>
                Sign in with Google
              </span>
            </button>

            <p className="text-sm text-gray-500 mt-6">
              {isLoginView ? "Don't have an account?" : 'Already have an account?'}
              <button onClick={() => setIsLoginView(!isLoginView)} className="font-medium text-blue-600 hover:underline ml-1">
                {isLoginView ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
            <p className="text-xs text-gray-400 mt-4">
              By continuing, you agree to our{' '}
              <a href="/terms" className="text-blue-500 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-500 hover:underline">
                Privacy Policy
              </a>.
            </p>
          </div>
        </div>
      </div >
    </div >
  );
};

export default LoginPage;
