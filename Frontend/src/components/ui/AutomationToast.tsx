import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AutomationToastProps {
    message?: string | null;
    variant: 'success' | 'error';
    onClose: () => void;
}

const AutomationToast: React.FC<AutomationToastProps> = ({ message, variant, onClose }) => {
    useEffect(() => {
        if (!message) return undefined;

        const timeoutId = window.setTimeout(() => {
            onClose();
        }, 4000);

        return () => window.clearTimeout(timeoutId);
    }, [message, onClose]);

    if (!message) return null;

    const isSuccess = variant === 'success';

    return (
        <div className="fixed right-4 top-4 z-[220] pointer-events-none sm:right-6">
            <div
                className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl animate-in slide-in-from-right-8 fade-in duration-300 ${
                    isSuccess
                        ? 'bg-success text-success-foreground'
                        : 'bg-destructive text-destructive-foreground'
                }`}
            >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em]">
                        {isSuccess ? 'Success' : 'Error'}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default AutomationToast;
