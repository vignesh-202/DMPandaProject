import React from 'react';
import { cn } from '../lib/utils';

interface AdminLoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  fullScreen?: boolean;
}

export const AdminLoadingState: React.FC<AdminLoadingStateProps> = ({
  title = 'Loading section',
  description = 'Loading workspace configuration and syncing data...',
  className,
  fullScreen = false
}) => {
  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-300',
        fullScreen
          ? 'fixed inset-0 z-[200] h-[100dvh] w-[100dvw] bg-background px-6'
          : className?.includes('min-h-')
            ? `relative w-full rounded-[28px] border border-border/70 bg-background/95 px-6 py-12 backdrop-blur-sm ${className}`
            : `absolute inset-0 z-50 bg-background/90 px-6 backdrop-blur-sm ${className || ''}`
      )}
    >
      {/* Radiant ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-[18vh] mx-auto h-40 w-40 rounded-full bg-primary/12 blur-3xl" />

      {/* Loading Panda Visual */}
      <div className="relative flex h-48 w-48 items-center justify-center drop-shadow-2xl">
        <picture className="flex h-full w-full items-center justify-center">
          <source srcSet="/images/loading_panda.webp" type="image/webp" />
          <img
            src="/images/loading_panda.gif"
            alt="Loading..."
            className="h-full w-full object-contain"
            width={192}
            height={192}
          />
        </picture>
      </div>

      {/* Typography */}
      <div className="relative space-y-1.5 px-4">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {description && (
          <p className="max-w-md text-xs font-medium leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminLoadingState;
