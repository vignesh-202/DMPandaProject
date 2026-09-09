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
            const response = await fetch(`${((globalThis as any).__DM_PANDA_ADMIN_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/auth/google?${params.toString()}`, {
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
            const response = await fetch(`${((globalThis as any).__DM_PANDA_ADMIN_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/forgot-password`, {
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
        <div className="min-h-screen overflow-y-auto flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-3 py-16 sm:px-4 sm:py-20 transition-colors duration-500">
            <div className="w-full max-w-4xl mx-auto my-4 bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 shadow-2xl dark:shadow-black/50 rounded-2xl flex overflow-hidden transition-colors duration-500">
                {/* Left Brand Panel */}
                <div className="hidden md:flex w-1/2 bg-neutral-950 text-white p-10 lg:p-12 flex-col justify-between relative overflow-hidden">
                    <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#405DE6]/20 blur-3xl pointer-events-none" />
                    <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-[#FD1D1D]/15 blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-purple-300 mb-6 backdrop-blur-md">
                            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#405DE6] to-[#FD1D1D]" />
                            DM Panda Administration
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
                            Automate Your DMs, <br />
                            <span className="bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] bg-clip-text text-transparent">
                                Grow Your Brand
                            </span>
                        </h2>
                        <p className="text-neutral-400 text-sm leading-relaxed">
                            Manage DM Panda operations, users, plans, and analytics from one focused admin workspace.
                        </p>
                    </div>

                    <div className="relative z-10 my-8">
                        <ul className="space-y-3.5 text-sm">
                            <li className="flex items-center gap-3 text-neutral-300">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                                <span>User & plan quota controls</span>
                            </li>
                            <li className="flex items-center gap-3 text-neutral-300">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                                <span>Automation oversight & monitoring</span>
                            </li>
                            <li className="flex items-center gap-3 text-neutral-300">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</span>
                                <span>Live revenue & analytics signals</span>
                            </li>
                        </ul>
                    </div>

                    <div className="relative z-10 pt-4 border-t border-white/10 text-xs text-neutral-500 font-medium">
                        Protected Admin Control Center &bull; Authorized Access Only
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center overflow-y-auto">
                    <div className="text-center w-full">
                        <img src="/logo.png" alt="DM Panda Logo" className="mx-auto mb-3" style={{ maxHeight: '56px' }} />
                        <h2 className="text-2xl font-bold tracking-tight mb-1.5 text-gray-900 dark:text-white">Welcome Back!</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Sign in to continue to the admin dashboard.</p>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-xl mb-4 text-xs font-medium text-left">
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl mb-4 text-xs font-medium text-left">
                                {successMessage}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="admin@dmpanda.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#833AB4] focus:ring-2 focus:ring-[#833AB4]/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-gray-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#833AB4] focus:ring-2 focus:ring-[#833AB4]/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-gray-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((current) => !current)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="text-right pt-0.5">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs font-medium text-[#833AB4] dark:text-purple-400 hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#833AB4]/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign In
                            </button>
                        </form>

                        <div className="relative my-5">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-neutral-800" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-2 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-500 font-medium">OR</span>
                            </div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full relative flex items-center justify-center px-4 py-2.5 border border-gray-300 dark:border-neutral-700 text-sm font-semibold rounded-xl text-gray-800 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-750 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C43.021,36.226,44,30.425,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                </svg>
                                <span>Sign in with Google</span>
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

