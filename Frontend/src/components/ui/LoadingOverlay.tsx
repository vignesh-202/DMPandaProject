import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'fullscreen';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message, 
  subMessage,
  className,
  variant = 'default'
}) => {
  if (variant === 'fullscreen') {
    const overlayRoot = typeof document !== 'undefined'
      ? document.querySelector('[data-dashboard-section-overlay-root]') as HTMLElement | null
      : null;
    const isSectionViewportOverlay = Boolean(overlayRoot);
    const fullscreenContent = (
      <div className={cn(
        isSectionViewportOverlay
          ? 'pointer-events-auto absolute inset-0 z-[140] flex h-full w-full flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm animate-in fade-in duration-300'
          : 'pointer-events-auto fixed inset-0 z-[140] flex h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-4 bg-background px-6 text-center animate-in fade-in duration-300',
        className
      )}>
        <div className="absolute inset-x-0 top-[18vh] mx-auto h-40 w-40 rounded-full bg-primary/12 blur-3xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/15 bg-card/90 shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div className="relative space-y-1.5">
          <p className="text-sm font-bold text-foreground">{message || 'Loading section'}</p>
          {subMessage && <p className="max-w-md text-xs font-medium leading-5 text-muted-foreground">{subMessage}</p>}
        </div>
      </div>
    );

    if (overlayRoot) {
      return createPortal(fullscreenContent, overlayRoot);
    }

    if (typeof document !== 'undefined') {
      return createPortal(fullscreenContent, document.body);
    }

    return fullscreenContent;
  }

  return (
    <div className={cn(
      "absolute inset-0 z-50 flex flex-col items-center justify-center rounded-inherit",
      "bg-background/80 backdrop-blur-sm",
      className
    )}>
      <Loader2 className={cn('text-primary animate-spin', variant === 'minimal' ? 'h-7 w-7' : 'h-8 w-8')} />
      {message && (
        <div className="mt-3 space-y-1 text-center">
          <p className="text-sm font-bold text-foreground">{message}</p>
          {subMessage && variant !== 'minimal' && <p className="text-xs font-medium text-muted-foreground">{subMessage}</p>}
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay;
