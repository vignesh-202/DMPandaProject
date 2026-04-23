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
        'relative isolate flex h-full w-full flex-1 items-center justify-center overflow-hidden rounded-[32px] border border-border/60 bg-[linear-gradient(180deg,rgba(18,22,28,0.9),rgba(30,34,41,0.84))] px-6 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl',
        fullScreen ? 'min-h-[100dvh] rounded-none border-none bg-background' : 'min-h-[calc(100dvh-8.5rem)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,96,64,0.12),transparent_24%),radial-gradient(circle_at_center,rgba(64,93,230,0.18),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[31px] border border-white/6" />

      <div className="relative flex max-w-sm flex-col items-center text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/15 blur-2xl" />
          <span className="absolute inset-[10px] rounded-full border border-primary/15" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[28px] border border-border/80 bg-card/95 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/75">Admin Workspace</p>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm font-medium leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoadingState;
