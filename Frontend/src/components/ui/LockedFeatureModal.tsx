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
                className="absolute inset-0 bg-foreground/30 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="ig-topline relative w-full max-w-[420px] bg-card rounded-[28px] shadow-2xl border border-border overflow-hidden animate-fadeInScale">

                {/* Decorative Top Gradient */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-ig-gradient" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 sm:p-10">
                    {/* Icon Header */}
                    <div className="flex justify-center mb-8 relative">
                        <div className="relative">
                            {/* Outer Glow */}
                            <div className="absolute inset-0 bg-ig-pink/20 blur-2xl rounded-full" />

                            {/* Main Icon Container */}
                            <div className="relative w-20 h-20 bg-ig-gradient rounded-[22px] flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                                <Instagram className="w-10 h-10 text-white" />
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-card rounded-full flex items-center justify-center border-4 border-card shadow-md">
                                    <Lock className="w-4 h-4 text-foreground" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="text-center space-y-4 mb-10">
                        <h3 className="text-2xl font-bold text-foreground tracking-tight">
                            Instagram Required
                        </h3>
                        <p className="text-muted-foreground text-base leading-relaxed">
                            <span className="font-semibold text-foreground">{featureName}</span> requires a connected Instagram Business account to function.
                        </p>
                    </div>

                    {/* Value Props */}
                    <div className="space-y-3 mb-10">
                        {[
                            "Automate your DMs & Comments",
                            "Schedule & manage posts effortlessly",
                            "Get deep insights into your growth"
                        ].map((text, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground bg-secondary p-3 rounded-xl border border-border">
                                <div className="w-1.5 h-1.5 rounded-full bg-ig-pink" />
                                {text}
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={onConnect}
                            className="group relative w-full py-4 bg-ig-gradient text-white rounded-2xl font-bold text-base transition-all duration-200 hover:shadow-ig-glow active:scale-[0.98] flex items-center justify-center gap-2 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-ig-purple via-ig-pink to-ig-yellow opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <span className="relative z-10 flex items-center gap-2">
                                Connect Instagram
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-3 text-muted-foreground font-semibold text-sm hover:text-foreground transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>

                    {/* Trust Badge */}
                    <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Secure & Official API
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LockedFeatureModal;
