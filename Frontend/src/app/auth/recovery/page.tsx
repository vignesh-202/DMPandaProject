import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import PasswordStrengthIndicator from '../../../components/ui/PasswordStrength';

const PasswordRecoveryPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [userId, setUserId] = useState('');
    const [secret, setSecret] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const userIdParam = params.get('userId');
        const secretParam = params.get('secret');

        if (userIdParam && secretParam) {
            setUserId(userIdParam);
            setSecret(secretParam);
        } else {
            setError('Invalid recovery link. Please request a new password reset.');
        }
    }, [location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/auth/recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, secret, newPassword, confirmPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            } else {
                throw new Error(data.error || 'Failed to reset password.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-colors duration-500">
                <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl dark:shadow-black/40 max-w-md w-full text-center border border-gray-100 dark:border-white/[0.06]">
                    <div className="text-green-500 text-5xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Password Reset Successful!</h2>
                    <p className="text-gray-600 dark:text-gray-400">Redirecting you to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4 transition-colors duration-500">
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-xl dark:shadow-black/40 max-w-md w-full border border-gray-100 dark:border-white/[0.06]">
                <div className="text-center mb-8">
                    <img src="/images/logo.png" alt="DM Panda Logo" className="mx-auto mb-4" style={{ maxHeight: '70px' }} />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reset Your Password</h2>
                    <p className="text-gray-600 dark:text-gray-400">Enter your new password below.</p>
                </div>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-md mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="w-full text-gray-900 dark:text-white bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <PasswordStrengthIndicator password={newPassword} />
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Input
                                type="password"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full text-gray-900 dark:text-white bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                            {confirmPassword && (
                                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                                    {newPassword === confirmPassword ? (
                                        <Check size={18} className="text-green-500" />
                                    ) : (
                                        <X size={18} className="text-red-500" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                        disabled={isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reset Password
                    </Button>
                </form>

                <div className="text-center mt-6">
                    <a href="/login" className="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                        Back to Login
                    </a>
                </div>
            </div>
        </div>
    );
};

export default PasswordRecoveryPage;

