import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Instagram, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const InstagramCallback: React.FC = () => {
    const { authenticatedFetch, isAuthenticated, checkAuth } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const processedRef = useRef(false);
    const [phaseIndex, setPhaseIndex] = useState(0);

    const phases = [
        'Authorizing with Meta...',
        'Syncing Instagram profile...',
        'Finalizing workspace setup...'
    ];

    useEffect(() => {
        const timer1 = setTimeout(() => setPhaseIndex(1), 1200);
        const timer2 = setTimeout(() => setPhaseIndex(2), 2600);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorReason = searchParams.get('error_reason');
        const errorDescription = searchParams.get('error_description');
        const state = searchParams.get('state');

        if (processedRef.current || isAuthenticated === false) {
            if (isAuthenticated === false) {
                console.error('Not authenticated, cannot link Instagram');
                navigate('/login');
            }
            return;
        }

        // Wait for auth to initialize
        if (isAuthenticated === null) return;

        processedRef.current = true;

        // User cancelled OAuth flow (e.g. error=access_denied, error_reason=user_denied)
        if (error === 'access_denied' || errorReason === 'user_denied') {
            console.log('Instagram connection process was cancelled by user');
            navigate('/dashboard?info=instagram_link_cancelled');
            return;
        }

        if (error) {
            console.error('Instagram Auth Error:', error, errorReason, errorDescription);
            const isOffMeta = (errorDescription || '').toLowerCase().includes('off meta') ||
                              (errorDescription || '').toLowerCase().includes('future activity') ||
                              (error || '').toLowerCase().includes('off_meta');
            if (isOffMeta) {
                navigate('/dashboard?error=off_meta_activity_disabled');
            } else {
                navigate(`/dashboard?error=instagram_auth_failed&msg=${encodeURIComponent(errorDescription || error)}`);
            }
            return;
        }

        if (code) {
            const linkInstagram = async () => {
                try {
                    const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/auth/instagram-callback`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ code, state }),
                    });

                    if (response.ok) {
                        const data = await response.json().catch(() => null);
                        const newAccountId = data?.account_id;
                        if (newAccountId) {
                            try {
                                localStorage.setItem('dm_panda_active_account_id', String(newAccountId));
                                sessionStorage.setItem('dm_panda_pending_select_account_id', String(newAccountId));
                            } catch (_) {}
                        }
                        await checkAuth();
                        const targetUrl = newAccountId
                            ? `/dashboard?success=instagram_linked&account_id=${encodeURIComponent(newAccountId)}`
                            : '/dashboard?success=instagram_linked';
                        navigate(targetUrl);
                    } else {
                        const data = await response.json().catch(() => ({}));
                        console.error('Failed to link Instagram:', data?.error);
                        if (data?.code === 'OFF_META_ACTIVITY_DISABLED' || (data?.error || '').toLowerCase().includes('off meta')) {
                            navigate('/dashboard?error=off_meta_activity_disabled');
                        } else {
                            navigate(`/dashboard?error=instagram_link_failed&msg=${encodeURIComponent(data?.error || 'Failed to link Instagram')}`);
                        }
                    }
                } catch (err) {
                    console.error('Network error during IG linking:', err);
                    navigate('/dashboard?error=network_error');
                }
            };
            linkInstagram();
        } else {
            console.error('No code received from Instagram');
            navigate('/dashboard');
        }
    }, [searchParams, navigate, authenticatedFetch, isAuthenticated, checkAuth]);

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-[#0B0F17] text-slate-800 dark:text-slate-100 transition-colors duration-500 overflow-hidden select-none">
            {/* Ambient Background Glows */}
            <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-purple-500/15 via-pink-500/15 to-transparent blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-500/15 via-indigo-500/15 to-transparent blur-3xl" />

            {/* Central Sleek Card */}
            <div className="relative z-10 w-full max-w-sm rounded-3xl p-8 sm:p-9 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 flex flex-col items-center text-center">
                {/* Modern Layered Connection Glyph */}
                <div className="relative mb-6">
                    {/* Outer dashed spinning track */}
                    <div className="absolute -inset-3 rounded-[26px] border border-dashed border-slate-300 dark:border-slate-700 animate-[spin_10s_linear_infinite]" />
                    
                    {/* Ambient glow behind icon */}
                    <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] opacity-30 blur-md animate-pulse" />

                    {/* Central Icon Container */}
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] shadow-lg shadow-pink-500/25 text-white">
                        <Instagram className="w-10 h-10 stroke-[1.75]" />
                    </div>

                    {/* Floating Status Ring Badge */}
                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-[#111827] shadow-md border border-slate-200 dark:border-slate-700">
                        <Loader2 className="h-3.5 w-3.5 text-[#E1306C] animate-spin" />
                    </div>
                </div>

                {/* Typography Hierarchy */}
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Connecting Instagram
                </h2>
                
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium h-4 transition-all duration-300">
                    {phases[phaseIndex]}
                </p>

                {/* Sleek indeterminate progress bar */}
                <div className="w-44 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-6 relative">
                    <div className="h-full bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] w-full animate-pulse" />
                </div>

                {/* Security Tag */}
                <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/60 text-[11px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Official Meta API Handshake</span>
                </div>
            </div>
        </div>
    );
};

export default InstagramCallback;
