import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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
    return (
      <div className={cn(
        "absolute inset-0 z-[110] flex items-center justify-center",
        "bg-background/95 backdrop-blur-xl",
        "animate-in fade-in duration-300",
        className
      )}>
        <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
          {/* Animated rings - distinct from layout loader */}
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 rounded-full border-4 border-primary/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.2s' }} />
            <div className="absolute inset-4 rounded-full border-4 border-primary/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-primary animate-spin" style={{ animationDuration: '1.5s' }} />
            </div>
          </div>
          
          {message && (
            <div className="space-y-2">
              <h3 className="text-xl font-black text-foreground tracking-tight">
                {message}
              </h3>
              {subMessage && (
                <p className="text-sm text-muted-foreground font-medium">
                  {subMessage}
                </p>
              )}
            </div>
          )}
          
          {/* Progress bar animation */}
          <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full"
              style={{
                animation: 'shimmer 1.5s infinite',
                width: '50%',
                backgroundSize: '200% 100%'
              }}
            />
          </div>
          
          <style>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "absolute inset-0 z-50 flex flex-col items-center justify-center rounded-inherit",
      "bg-background/80 backdrop-blur-sm",
      className
    )}>
      {variant === 'default' ? (
        <>
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-muted border-t-primary animate-spin" />
          </div>
          {message && (
            <p className="mt-4 text-sm font-medium text-foreground">
              {message}
            </p>
          )}
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          {message && (
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default LoadingOverlay;
