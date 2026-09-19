import React from 'react';
import { cn } from '../lib/utils';

interface AdminLoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  fullScreen?: boolean;
}

export const AdminLoadingState: React.FC<AdminLoadingStateProps> = ({
  title = 'Initializing Workspace Console',
  description = 'Syncing real-time telemetry, user clusters, and system access policies...',
  className,
  fullScreen = false
}) => {
  return (
    <div
      className={cn(
        'isolate flex flex-col items-center justify-center overflow-hidden',
        fullScreen
          ? 'fixed inset-0 z-[200] bg-[#090D14]/95 backdrop-blur-2xl'
          : className?.includes('min-h-')
            ? `relative w-full rounded-[28px] border border-border/70 bg-card/90 px-6 py-12 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl ${className}`
            : `absolute inset-0 z-50 bg-[#090D14]/80 backdrop-blur-md ${className || ''}`
      )}
    >
      {/* Dynamic Ambient Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-96 rounded-full bg-primary/10 blur-[90px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06),transparent_70%)]" />

      <div
        className={cn(
          'relative flex max-w-md flex-col items-center px-6 text-center',
          !className?.includes('min-h-') && 'sticky top-[50vh] -translate-y-1/2'
        )}
      >
        {/* Orbital Radar Indicator */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          {/* Outermost pulsing ring */}
          <span className="absolute inset-0 animate-ping rounded-full border border-primary/20 opacity-40 duration-1000" />
          
          {/* Counter-rotating track 1 */}
          <div className="absolute inset-1 animate-spin rounded-full border-2 border-dashed border-primary/30 [animation-duration:8s]" />
          
          {/* Counter-rotating track 2 */}
          <div className="absolute inset-3 animate-spin rounded-full border border-t-primary border-r-transparent border-b-primary/40 border-l-transparent [animation-duration:2.5s] [animation-direction:reverse]" />

          {/* Central Orb */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-background/90 to-card/95 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="relative h-4 w-4">
              <span className="absolute inset-0 animate-pulse rounded-full bg-primary blur-[4px]" />
              <span className="relative block h-4 w-4 rounded-full bg-primary shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
            </div>
          </div>
        </div>

        {/* Shimmering Telemetry Tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold tracking-widest text-primary uppercase shadow-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span>Console Telemetry</span>
        </div>

        {/* Title & Description */}
        <h2 className="mt-3 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted-foreground">
          {description}
        </p>

        {/* Subtle Micro-Progress Track */}
        <div className="mt-5 h-1 w-44 overflow-hidden rounded-full bg-muted/60 border border-border/40">
          <div className="h-full w-1/3 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 [animation:indeterminate_1.8s_infinite_linear]" />
        </div>
      </div>
    </div>
  );
};

export default AdminLoadingState;
