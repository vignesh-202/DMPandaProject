import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Check, X, Eye, EyeOff, Instagram, CheckCircle, Mail, Lock, RefreshCw, LogOut, Trash2, Pencil } from 'lucide-react';
import PasswordStrengthIndicator from '../../components/ui/PasswordStrength';

// Modern spinning loader component
const ModernLoader = ({ size = 'md', text = '' }: { size?: 'sm' | 'md' | 'lg', text?: string }) => {
    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative">
                <div className={`${sizeClasses[size]} rounded-full border-2 border-gray-200 dark:border-gray-700`}></div>
                <div className={`${sizeClasses[size]} rounded-full border-2 border-transparent border-t-purple-500 border-r-pink-500 absolute top-0 left-0 animate-spin`}></div>
            </div>
            {text && (
                <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">{text}</p>
            )}
        </div>
    );
};

// Full screen loading component
const FullScreenLoader = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4">
                <div className="w-full h-full rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                <div className="w-full h-full rounded-full border-4 border-transparent border-t-black dark:border-t-white absolute top-0 left-0 animate-spin"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 animate-pulse text-sm sm:text-base">Loading your account...</p>
        </div>
    </div>
);

const OnboardingFlow: React.FC = () => {
    const { logout, setHasPasswordManually, login, hasPassword, isVerified, hasLinkedInstagram, user, isLoading: isAuthLoading, authenticatedFetch } = useAuth();
    const navigate = useNavigate();

    // Loading states
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isVerifyingInstagram, setIsVerifyingInstagram] = useState(false);

    // Form states
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Email change state
    const [showEmailChange, setShowEmailChange] = useState(false);
    const [newEmail, setNewEmail] = useState('');

    // Completed steps tracking
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setDeletePassword('');
        setDeleteError(null);
        setIsDeleting(false);
    };

    // Check if coming back from Instagram OAuth
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ig_linking') === 'true') {
            setIsVerifyingInstagram(true);
        }
    }, []);

    // Handle initial loading - hide as soon as we have user data
    useEffect(() => {
        if (!isAuthLoading && user) {
            setIsInitialLoading(false);
        }
    }, [isAuthLoading, user]);

    // Track completed steps
    useEffect(() => {
        const completed: string[] = [];
        if (isVerified) completed.push('verify');
        if (hasPassword !== false) completed.push('password');
        if (hasLinkedInstagram) completed.push('instagram');
        setCompletedSteps(completed);
    }, [hasPassword, isVerified, hasLinkedInstagram]);

    // Redirect to dashboard when all steps complete
    useEffect(() => {
        if (hasPassword !== false && isVerified && hasLinkedInstagram) {
            navigate('/dashboard');
        }
    }, [hasPassword, isVerified, hasLinkedInstagram, navigate]);

    // Step order: 1. Verify Email → 2. Set Password → 3. Link Instagram
    const getCurrentStep = (): 'verify' | 'password' | 'instagram' => {
        if (!isVerified) return 'verify';
        if (hasPassword === false) return 'password';
        return 'instagram';
    };

    const currentStep = getCurrentStep();

    // All 3 steps in order
    const allSteps = [
        { id: 'verify', label: 'Verify', icon: <Mail size={16} /> },
        { id: 'password', label: 'Password', icon: <Lock size={16} /> },
        { id: 'instagram', label: 'Instagram', icon: <Instagram size={16} /> }
    ];

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/set-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok) {
                setHasPasswordManually(true);
                setSuccessMessage('Password set successfully!');
                await login();
                setTimeout(() => setSuccessMessage(null), 2000);
            } else {
                throw new Error(data.error || 'Failed to set password.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendVerification = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/resend-verification`, {
                method: 'POST'
            });

            const data = await response.json();
            if (response.ok) {
                setSuccessMessage('Verification email sent! Check your inbox.');
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                throw new Error(data.error || 'Failed to send verification email.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/change-unverified-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: newEmail })
            });

            const data = await response.json();
            if (response.ok) {
                setSuccessMessage('Email changed! Please verify your new email.');
                setShowEmailChange(false);
                setNewEmail('');
                await login();
                // Clear success message after redirect to step 1
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                throw new Error(data.error || 'Failed to change email.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInstagramLink = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/instagram/url`);
            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to get Instagram login URL.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start Instagram login.');
            setIsSubmitting(false);
        }
    };

    // Show full-screen loader while initial data loads
    if (isInitialLoading || isAuthLoading || !user) {
        return <FullScreenLoader />;
    }

    // Show Instagram verification loader
    if (isVerifyingInstagram) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 p-4">
                <div className="text-center">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6">
                        <div className="w-full h-full rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                        <div className="w-full h-full rounded-full border-4 border-transparent border-t-purple-500 border-r-pink-500 absolute top-0 left-0 animate-spin" style={{ animationDuration: '0.8s' }}></div>
                        <Instagram className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 text-pink-500" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">Connecting Instagram</h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 animate-pulse">Verifying your account...</p>
                </div>
            </div>
        );
    }

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-6 sm:mb-8 px-2">
            {allSteps.map((step, index) => {
                const isCompleted = completedSteps.includes(step.id);
                const isCurrent = step.id === currentStep;
                const stepIndex = index + 1;

                return (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center">
                            <div
                                className={`
                                    relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-500 ease-out overflow-hidden
                                    ${isCompleted
                                        ? 'text-white scale-100'
                                        : isCurrent
                                            ? 'bg-black text-white dark:bg-white dark:text-black scale-105 sm:scale-110 shadow-lg'
                                            : 'bg-gray-200 text-gray-500 dark:bg-gray-700 scale-100'
                                    }
                                `}
                            >
                                {/* Water flow animation for completed steps */}
                                {isCompleted && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-water-flow"></div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                                    </>
                                )}
                                <span className="relative z-10">
                                    {isCompleted ? (
                                        <Check size={18} className="animate-[bounceIn_0.3s_ease-out]" />
                                    ) : (
                                        <span className="text-sm sm:text-base font-semibold">{stepIndex}</span>
                                    )}
                                </span>
                            </div>
                            <span className={`
                                mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium transition-all duration-300 text-center
                                ${isCompleted
                                    ? 'text-green-600 dark:text-green-400'
                                    : isCurrent
                                        ? 'text-black dark:text-white font-semibold'
                                        : 'text-gray-400'
                                }
                            `}>
                                {step.label}
                            </span>
                        </div>
                        {index < allSteps.length - 1 && (
                            <div className={`
                                relative w-8 sm:w-16 h-1 mx-1 sm:mx-3 rounded-full overflow-hidden transition-all duration-500 ease-out
                                ${isCompleted ? '' : 'bg-gray-200 dark:bg-gray-700'}
                            `}>
                                {isCompleted && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-water-flow"></div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
                                    </>
                                )}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );

    const renderVerificationStep = () => (
        <div className="animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center mb-4 sm:mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center transition-transform hover:scale-105">
                    <Mail className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Verify Your Email</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    We sent a verification link to:
                </p>
                <p className="font-semibold text-gray-900 dark:text-white mt-1 text-sm sm:text-base break-all">{user?.email}</p>
            </div>

            {!showEmailChange ? (
                <div className="space-y-3 sm:space-y-4">
                    <Button
                        onClick={handleResendVerification}
                        className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-all duration-300 transform hover:scale-[1.02] text-sm sm:text-base py-2 sm:py-3"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ModernLoader size="sm" />
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Resend Verification Email
                            </>
                        )}
                    </Button>

                    <Button
                        onClick={() => {
                            setSuccessMessage(null);
                            login();
                        }}
                        variant="outline"
                        className="w-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs sm:text-sm py-2"
                    >
                        <RefreshCw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        I've verified → Refresh
                    </Button>
                </div>
            ) : (
                <form onSubmit={handleEmailChange} className="space-y-3 sm:space-y-4 animate-[fadeIn_0.2s_ease-out]">
                    <Input
                        type="email"
                        placeholder="New email address"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        className="w-full text-black dark:text-white text-sm sm:text-base"
                    />
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            onClick={() => {
                                setShowEmailChange(false);
                                setNewEmail('');
                            }}
                            className="flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-black text-white hover:bg-gray-800 transition-colors text-sm"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <ModernLoader size="sm" /> : 'Update'}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );

    const renderPasswordStep = () => (
        <div className="animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center mb-4 sm:mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center transition-transform hover:scale-105">
                    <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Set Your Password</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Secure your account with a password.
                </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 sm:space-y-4">
                <div className="relative">
                    <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="New Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pr-10 text-black dark:text-white transition-all focus:ring-2 focus:ring-black dark:focus:ring-white text-sm sm:text-base"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <PasswordStrengthIndicator password={password} />

                <div className="relative">
                    <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full pr-10 text-black dark:text-white transition-all focus:ring-2 focus:ring-black dark:focus:ring-white text-sm sm:text-base"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {confirmPassword && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 mr-1 transition-all">
                            {password === confirmPassword ? (
                                <Check size={18} className="text-green-500" />
                            ) : (
                                <X size={18} className="text-red-500" />
                            )}
                        </div>
                    )}
                </div>

                <Button
                    type="submit"
                    className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-all duration-300 transform hover:scale-[1.02] text-sm sm:text-base py-2 sm:py-3"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <ModernLoader size="sm" /> : 'Continue'}
                </Button>
            </form>
        </div>
    );

    const renderInstagramStep = () => (
        <div className="animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center mb-4 sm:mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center transition-transform hover:scale-105 hover:rotate-3">
                    <Instagram className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Link Your Instagram</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect your Instagram Business account.
                </p>
            </div>

            <div className="space-y-3 sm:space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 transition-colors">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs sm:text-sm">Requirements:</h3>
                    <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <li className="flex items-center">
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-green-500 flex-shrink-0" />
                            Instagram Business or Creator account
                        </li>
                        <li className="flex items-center">
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-green-500 flex-shrink-0" />
                            Account must be public
                        </li>
                    </ul>
                </div>

                <Button
                    onClick={handleInstagramLink}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg text-sm sm:text-base py-2 sm:py-3"
                >
                    {isSubmitting ? (
                        <ModernLoader size="sm" />
                    ) : (
                        <>
                            <Instagram className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            Connect Instagram Account
                        </>
                    )}
                </Button>

                <div className="flex flex-col items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors py-1 underline underline-offset-4"
                    >
                        Skip for now
                    </button>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 w-full">
                        <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 text-center leading-relaxed">
                            <strong>Note:</strong> Automation features will be locked until you connect an Instagram account.
                        </p>
                    </div>
                </div>

                <p className="text-[10px] sm:text-xs text-center text-gray-500 dark:text-gray-400">
                    We'll only access permissions needed for DM automation.
                </p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-gray-900 shadow-2xl rounded-xl sm:rounded-2xl p-5 sm:p-8 border border-gray-200 dark:border-gray-800 transition-all duration-300 my-4">
                {renderStepIndicator()}

                {error && (
                    <div className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 p-2.5 sm:p-3 rounded-md mb-3 sm:mb-4 text-xs sm:text-sm animate-[shake_0.3s_ease-out]">
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 p-2.5 sm:p-3 rounded-md mb-3 sm:mb-4 text-xs sm:text-sm animate-[fadeIn_0.3s_ease-out]">
                        {successMessage}
                    </div>
                )}

                {currentStep === 'verify' && renderVerificationStep()}
                {currentStep === 'password' && renderPasswordStep()}
                {currentStep === 'instagram' && renderInstagramStep()}

                {/* Footer Buttons - Different for each step */}
                <div className="mt-6 sm:mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {currentStep === 'instagram' ? (
                        // Instagram step: Logout + Delete Account
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button
                                onClick={logout}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
                            >
                                <Trash2 size={16} />
                                Delete Account
                            </button>
                        </div>
                    ) : (
                        // Verify/Password steps: Change Email + Logout
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button
                                onClick={() => setShowEmailChange(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
                            >
                                <Pencil size={16} />
                                Change Email
                            </button>
                            <button
                                onClick={logout}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl rounded-xl p-6 border border-gray-200 dark:border-gray-800 animate-[fadeIn_0.2s_ease-out]">
                        <div className="text-center mb-4">
                            <div className="w-12 h-12 mx-auto mb-3 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Account</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                This action is permanent and cannot be undone.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Input
                                type="password"
                                placeholder="Enter your password to confirm"
                                value={deletePassword}
                                onChange={(e) => {
                                    setDeletePassword(e.target.value);
                                    if (deleteError) setDeleteError(null);
                                }}
                                className="w-full text-black dark:text-white text-sm"
                                error={deleteError || undefined}
                            />

                            <div className="flex gap-2">
                                <Button
                                    onClick={closeDeleteModal}
                                    className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={async () => {
                                        if (!deletePassword) {
                                            setDeleteError('Please enter your password.');
                                            return;
                                        }
                                        setIsDeleting(true);
                                        setDeleteError(null);
                                        try {
                                            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/delete`, {
                                                method: 'DELETE',
                                                headers: {
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({ password: deletePassword }),
                                            });
                                            const data = await response.json();
                                            if (response.ok) {
                                                await logout();
                                            } else {
                                                setDeleteError(data.error || 'Failed to delete account.');
                                                setIsDeleting(false);
                                            }
                                        } catch (err: any) {
                                            setDeleteError('An error occurred. Please try again.');
                                            setIsDeleting(false);
                                        }
                                    }}
                                    className="flex-1 bg-red-600 text-white hover:bg-red-700"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? <ModernLoader size="sm" /> : 'Delete'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Global Email Change Modal */}
            {showEmailChange && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl rounded-xl p-6 border border-gray-200 dark:border-gray-800 animate-[fadeIn_0.2s_ease-out]">
                        <div className="text-center mb-4">
                            <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <Pencil className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change Email</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Current: <span className="font-medium">{user?.email}</span>
                            </p>
                        </div>

                        <form onSubmit={handleEmailChange} className="space-y-3">
                            <Input
                                type="email"
                                placeholder="New email address"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                required
                                className="w-full text-black dark:text-white text-sm"
                            />

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setShowEmailChange(false);
                                        setNewEmail('');
                                        setError(null);
                                    }}
                                    className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <ModernLoader size="sm" /> : 'Update'}
                                </Button>
                            </div>
                        </form>

                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                            You'll need to verify the new email address.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingFlow;
