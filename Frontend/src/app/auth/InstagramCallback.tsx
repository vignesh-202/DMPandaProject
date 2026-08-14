import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ModernLoader from '../../components/ui/ModernLoader';
import { useAuth } from '../../contexts/AuthContext';

const InstagramCallback: React.FC = () => {
    const { authenticatedFetch, isAuthenticated, checkAuth } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const processedRef = useRef(false);

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
                        await checkAuth();
                        navigate('/dashboard?success=instagram_linked');
                    } else {
                        const data = await response.json();
                        console.error('Failed to link Instagram:', data.error);
                        if (data.code === 'OFF_META_ACTIVITY_DISABLED' || (data.error || '').toLowerCase().includes('off meta')) {
                            navigate('/dashboard?error=off_meta_activity_disabled');
                        } else {
                            navigate(`/dashboard?error=instagram_link_failed&msg=${encodeURIComponent(data.error || 'Failed to link Instagram')}`);
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
            <ModernLoader size="lg" variant="black" />
            <p className="mt-4 text-gray-600 font-medium animate-pulse">Connecting your Instagram...</p>
        </div>
    );
};

export default InstagramCallback;

