import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import httpClient from '../lib/httpClient';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { checkUser, user, loading: authLoading, isAdmin } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authError = params.get('error');
        const message = params.get('message');

        if (message) {
            setError(message);
        } else if (authError === 'admin_required') {
            setError('Only users with the admin label can access this dashboard.');
        } else if (authError === 'oauth_failed') {
            setError('Google sign-in failed. Please try again.');
        }
    }, []);

    useEffect(() => {
        if (!authLoading && user && isAdmin) {
            navigate('/', { replace: true });
        }
    }, [authLoading, isAdmin, navigate, user]);

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const finishAdminLogin = async () => {
        const session = await checkUser();
        const hasAdminLabel = Boolean(session?.labels?.includes('admin'));

        if (!hasAdminLabel) {
            await httpClient.get('/logout').catch(() => { });
            throw new Error('Only users with the admin label can access this dashboard.');
        }

        await checkUser();
        navigate('/', { replace: true });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValidEmail(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            await httpClient.post('/api/login', { email, password });
            await finishAdminLogin();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            const params = new URLSearchParams({
                target: 'admin',
                redirect_origin: window.location.origin
            });
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/google?${params.toString()}`, {
                credentials: 'include',
                headers: {
                    'X-App-Context': 'admin'
                }
            });
            const data = await response.json();

            if (!response.ok || !data.url) {
                throw new Error(data.error || 'Failed to start Google sign-in.');
            }

            window.location.href = data.url;
        } catch (err: any) {
            setError(err.message || 'Failed to start Google sign-in.');
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email || !isValidEmail(email)) {
            setError('Please enter a valid email address first.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Context': 'admin'
                },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reset email.');
            }

            setSuccessMessage('Password reset link sent! Check your email.');
        } catch (err: any) {
            setError(err.message || 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-colors duration-500">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-700 dark:text-gray-200" />
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Verifying session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-3 pt-20 pb-4 sm:px-4 sm:pt-24 transition-colors duration-500">
            <div className="w-full max-w-4xl mx-auto max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-7rem)] bg-white dark:bg-neutral-900 shadow-2xl dark:shadow-black/40 rounded-2xl flex overflow-hidden transition-colors duration-500">
                <div className="hidden md:flex w-1/2 bg-black dark:bg-neutral-800 text-white p-10 lg:p-12 flex-col justify-center">
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                        Automate Your DMs, Grow Your Brand
                    </h2>
                    <p className="text-gray-300 dark:text-gray-400 mb-8">
                        Manage DM Panda operations, users, plans, and analytics from one focused admin workspace.
                    </p>
                    <ul className="space-y-4">
                        <li className="flex items-center">
                            <span className="text-green-400 mr-3">✓</span>
                            <span>User and plan management</span>
                        </li>
                        <li className="flex items-center">
                            <span className="text-green-400 mr-3">✓</span>
                            <span>Automation oversight</span>
                        </li>
                        <li className="flex items-center">
                            <span className="text-green-400 mr-3">✓</span>
                            <span>Live analytics and controls</span>
                        </li>
                    </ul>
                </div>

                <div className="w-full md:w-1/2 p-6 sm:p-7 md:p-8 lg:p-10 flex flex-col justify-center">
                    <div className="text-center w-full">
                        <img src="/logo.png" alt="DM Panda Logo" className="mx-auto mb-3" style={{ maxHeight: '62px' }} />
                        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Welcome Back!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">Sign in to continue to the admin dashboard.</p>

                        {error && <p className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-xl mb-4">{error}</p>}
                        {successMessage && <p className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded-xl mb-4">{successMessage}</p>}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-gray-500"
                            />

                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-gray-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            <div className="text-right -mt-2">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                                disabled={loading}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign In
                            </button>
                        </form>

                        <div className="relative my-5">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-neutral-700" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-neutral-900 text-gray-500 dark:text-gray-400">OR</span>
                            </div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full group relative flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-black dark:bg-neutral-800 hover:bg-gray-800 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-neutral-900 transition-all duration-300 ease-in-out overflow-hidden disabled:opacity-50"
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

                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-5">
                            By continuing, you agree to our{' '}
                            <a href="/terms" className="text-blue-500 dark:text-blue-400 hover:underline">
                                Terms of Service
                            </a>{' '}
                            and{' '}
                            <a href="/privacy" className="text-blue-500 dark:text-blue-400 hover:underline">
                                Privacy Policy
                            </a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
