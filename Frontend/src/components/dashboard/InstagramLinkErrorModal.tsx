import React, { useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, X, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';

interface InstagramLinkErrorModalProps {
  isOpen: boolean;
  errorMessage?: string;
  onClose: () => void;
  onRetry: () => void;
}

/**
 * Design Read: SaaS automation dashboard for creators and business owners,
 * with a refined, tactile, high-contrast modern dark-theme language,
 * leaning toward Tailwind utilities + Lucide icons + spring physics and dynamic responsiveness across all screens (320px to 4K).
 */
export const InstagramLinkErrorModal: React.FC<InstagramLinkErrorModalProps> = ({
  isOpen,
  errorMessage,
  onClose,
  onRetry
}) => {
  // Close on Escape key press
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const displayMessage = errorMessage && errorMessage.trim().length > 0
    ? errorMessage.trim()
    : 'The authorization session was interrupted or permissions were declined on Meta.';

  return (
    <div 
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ig-error-title"
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-destructive/30 bg-card p-5 sm:p-7 md:p-8 shadow-2xl transition-all dark:bg-zinc-950 sm:scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-8 ring-destructive/5">
            <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>

          <h3 id="ig-error-title" className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Instagram Linking Failed
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-[42ch]">
            We could not complete the connection with Meta's Graph API.
          </p>
        </div>

        {/* Server / Meta Error Detail Callout */}
        <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 p-3.5 sm:p-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-1">
            Reason Reported
          </p>
          <p className="text-xs sm:text-sm text-foreground/90 font-medium break-words">
            {displayMessage}
          </p>
        </div>

        {/* Troubleshooting Checklist */}
        <div className="mt-5 rounded-2xl border border-border/80 bg-muted/30 p-4 sm:p-5 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Before trying again, please ensure:
          </h4>
          <ul className="space-y-2.5 text-xs sm:text-sm text-foreground/85">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>Your Instagram account is set to a <strong>Professional (Creator or Business)</strong> account. Personal accounts cannot use automations.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>In the Meta permissions prompt, ensure <strong>all checkboxes for messaging & profile access</strong> are granted.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>If your account is connected to a Facebook Page, select that Page during authorization.</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full sm:w-auto sm:min-w-[100px] rounded-xl py-2.5 text-sm font-semibold transition-transform active:scale-[0.98]"
          >
            Dismiss
          </Button>

          <Button
            onClick={() => {
              onClose();
              onRetry();
            }}
            className="w-full sm:flex-1 rounded-xl py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all active:scale-[0.98] -translate-y-[0.5px]"
          >
            <RefreshCw className="mr-2 h-4 w-4 animate-spin-reverse" />
            Try Linking Again
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstagramLinkErrorModal;
