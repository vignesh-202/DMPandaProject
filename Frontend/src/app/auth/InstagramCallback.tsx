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

        if (error) {
            console.error('Instagram Auth Error:', error);
            navigate('/dashboard?error=instagram_auth_failed');
            return;
        }

        if (code) {
            const linkInstagram = async () => {
                try {
                    const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/instagram-callback`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ code }),
                    });

                    if (response.ok) {
                        await checkAuth();
                        navigate('/dashboard?success=instagram_linked');
                    } else {
                        const data = await response.json();
                        console.error('Failed to link Instagram:', data.error);
                        navigate('/dashboard?error=instagram_link_failed');
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
