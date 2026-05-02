import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AdminLoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  fullScreen?: boolean;
}

export const AdminLoadingState: React.FC<AdminLoadingStateProps> = ({
  title = 'Loading admin workspace',
  description = 'Preparing live metrics, permissions, and operational data.',
  className,
  fullScreen = false
}) => {
  return (
    <div
      className={cn(
        'isolate flex flex-col items-center justify-center overflow-hidden',
        fullScreen 
          ? 'fixed inset-0 z-[200] bg-background' 
          : className?.includes('min-h-') 
            ? `relative w-full rounded-[32px] border border-border/60 bg-card/95 px-6 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${className}`
            : `absolute inset-0 z-50 bg-background/50 backdrop-blur-md ${className || ''}`
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[31px] border border-white/6" />

      <div className={cn(
        "relative flex max-w-sm flex-col items-center text-center",
        !className?.includes('min-h-') && "sticky top-[50vh] -translate-y-1/2"
      )}>
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/15 blur-2xl" />
          <span className="absolute inset-[10px] rounded-full border border-primary/15" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[28px] border border-border/80 bg-card/95 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-[10px] font-black text-primary/75">Admin Workspace</p>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm font-medium leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoadingState;
