import React from 'react';
import { ExternalLink, ShieldAlert, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface OffMetaActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export const OffMetaActivityModal: React.FC<OffMetaActivityModalProps> = ({
  isOpen,
  onClose,
  onRetry
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/20 bg-card p-6 sm:p-8 shadow-2xl transition-all dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon & Title Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h3 className="text-xl font-bold text-foreground sm:text-2xl">
            Meta Activity History is Turned Off
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Meta (Facebook/Instagram) blocked the login because your account's <strong className="text-foreground">"Off-Meta Activity"</strong> setting is currently disabled.
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="mt-6 rounded-2xl border border-border/80 bg-muted/40 p-4 sm:p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            How to enable it (takes 1 minute):
          </h4>
          <ol className="space-y-2.5 text-xs sm:text-sm text-foreground/90">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400">1</span>
              <span>Open <strong>Meta Accounts Centre</strong> using the button below.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400">2</span>
              <span>Go to <strong>Your information and permissions</strong> &rarr; <strong>Off-Meta Activity</strong>.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400">3</span>
              <span>Click <strong>Manage Future Activity</strong> and select <strong>Connect future activity</strong>.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400">4</span>
              <span>Return here and click <strong>Try Connecting Again</strong>.</span>
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="https://accountscenter.facebook.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full sm:flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-amber-400 active:scale-[0.98]"
          >
            Open Accounts Centre <ExternalLink className="h-4 w-4" />
          </a>

          {onRetry ? (
            <Button
              onClick={() => {
                onClose();
                onRetry();
              }}
              variant="outline"
              className="w-full sm:w-auto rounded-xl py-3 text-sm font-medium"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
          ) : (
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full sm:w-auto rounded-xl py-3 text-sm font-medium"
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OffMetaActivityModal;
