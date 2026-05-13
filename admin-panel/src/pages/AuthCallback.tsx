import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';

export const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { checkUser } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const finalizeGoogleLogin = async () => {
            const params = new URLSearchParams(location.search);
            const userId = params.get('userId');
            const secret = params.get('secret');

            if (!userId || !secret) {
                navigate('/login?error=oauth_failed', { replace: true });
                return;
            }

            try {
                const url = new URL(`${((globalThis as any).__DM_PANDA_ADMIN_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/auth/google-callback`);
                url.searchParams.append('userId', userId);
                url.searchParams.append('secret', secret);
                url.searchParams.append('target', 'admin');

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'X-App-Context': 'admin'
                    }
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to finalize Google sign-in.');
                }

                const session = await checkUser();
                const hasAdminLabel = Boolean(session?.labels?.includes('admin'));

                if (!hasAdminLabel) {
                    await httpClient.get('/logout').catch(() => { });
                    navigate('/login?error=admin_required', { replace: true });
                    return;
                }

                await checkUser();
                navigate('/', { replace: true });
            } catch (err: any) {
                setError(err.message || 'Authentication failed.');
                navigate(`/login?error=oauth_failed&message=${encodeURIComponent(err.message || 'Authentication failed.')}`, { replace: true });
            }
        };

        void finalizeGoogleLogin();
    }, [checkUser, location.search, navigate]);

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center px-6">
                <div className="glass-card ig-topline w-full max-w-lg rounded-[32px] p-10 text-center">
                    <p className="text-[10px] font-black text-muted-foreground">Authentication Error</p>
                    <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-foreground">Google sign-in failed</h1>
                    <p className="mt-3 text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <AdminLoadingState
            fullScreen
            title="Finishing Google sign-in"
            description="Verifying your session and confirming admin access."
        />
    );
};

export default AuthCallback;

