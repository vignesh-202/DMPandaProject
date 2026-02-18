import React, { useEffect } from 'react';
import { X, Instagram, Lock, ShieldAlert, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LockedFeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void;
    featureName?: string;
}

const LockedFeatureModal: React.FC<LockedFeatureModalProps> = ({
    isOpen,
    onClose,
    onConnect,
    featureName = "This feature"
}) => {
    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop with premium glassmorphism */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-[420px] bg-white dark:bg-gray-950 rounded-[28px] shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-fadeInScale">

                {/* Decorative Top Gradient */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 sm:p-10">
                    {/* Icon Header */}
                    <div className="flex justify-center mb-8 relative">
                        <div className="relative">
                            {/* Outer Glow */}
                            <div className="absolute inset-0 bg-pink-500/20 blur-2xl rounded-full" />

                            {/* Main Icon Container */}
                            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-[22px] flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                                <Instagram className="w-10 h-10 text-white" />
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-black dark:bg-white rounded-full flex items-center justify-center border-4 border-white dark:border-gray-950 shadow-md">
                                    <Lock className="w-4 h-4 text-white dark:text-black" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="text-center space-y-4 mb-10">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Instagram Required
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{featureName}</span> requires a connected Instagram Business account to function.
                        </p>
                    </div>

                    {/* Value Props */}
                    <div className="space-y-3 mb-10">
                        {[
                            "Automate your DMs & Comments",
                            "Schedule & manage posts effortlessly",
                            "Get deep insights into your growth"
                        ].map((text, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800/50">
                                <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                {text}
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={onConnect}
                            className="group relative w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base transition-all duration-200 hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_8px_25px_-5px_rgba(255,255,255,0.2)] active:scale-[0.98] flex items-center justify-center gap-2 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span className="relative z-10 flex items-center gap-2">
                                Connect Instagram
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-3 text-gray-500 dark:text-gray-400 font-semibold text-sm hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>

                    {/* Trust Badge */}
                    <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Secure & Official API
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LockedFeatureModal;
