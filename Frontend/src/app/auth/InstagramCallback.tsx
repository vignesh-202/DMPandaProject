import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ModernLoader from '../../components/ui/ModernLoader';

const InstagramCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const processedRef = useRef(false);

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (processedRef.current) return;
        processedRef.current = true;

        if (error) {
            console.error('Instagram Auth Error:', error);
            navigate('/dashboard?error=instagram_auth_failed');
            return;
        }

        if (code) {
            const linkInstagram = async () => {
                try {
                    const response = await fetch('http://localhost:5000/api/auth/instagram-callback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ code }),
                        mode: 'cors',
                        credentials: 'include'
                    });

                    if (response.ok) {
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
    }, [searchParams, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
            <ModernLoader size="lg" variant="black" />
            <p className="mt-4 text-gray-600 font-medium animate-pulse">Connecting your Instagram...</p>
        </div>
    );
};

export default InstagramCallback;
