import React from 'react';
import { cn } from '../../lib/utils';

type BrandedLoaderVariant = 'fullscreen' | 'page' | 'section' | 'inline';
type BrandedLoaderSize = 'sm' | 'md' | 'lg';

interface BrandedLoaderProps {
  title?: string;
  description?: string;
  variant?: BrandedLoaderVariant;
  size?: BrandedLoaderSize;
  className?: string;
}

const SIZE_CONFIG: Record<BrandedLoaderSize, { shell: string; logo: string; title: string; description: string }> = {
  sm: {
    shell: 'w-24 h-24',
    logo: 'w-10 h-10 rounded-2xl',
    title: 'text-base',
    description: 'text-xs'
  },
  md: {
    shell: 'w-28 h-28',
    logo: 'w-12 h-12 rounded-[1.35rem]',
    title: 'text-xl',
    description: 'text-sm'
  },
  lg: {
    shell: 'w-32 h-32',
    logo: 'w-16 h-16 rounded-[1.55rem]',
    title: 'text-2xl',
    description: 'text-sm'
  }
};

const VARIANT_WRAPPERS: Record<BrandedLoaderVariant, string> = {
  fullscreen: 'absolute inset-0 z-[110] bg-background/95 backdrop-blur-xl',
  page: 'w-full min-h-[50vh]',
  section: 'w-full min-h-[24rem] rounded-[2rem] border border-content/70 bg-card/70',
  inline: 'w-full'
};

const BrandedLoader: React.FC<BrandedLoaderProps> = ({
  title = 'Loading your workspace',
  description = 'Preparing the latest account data before the view appears.',
  variant = 'page',
  size = 'md',
  className
}) => {
  const config = SIZE_CONFIG[size];

  return (
    <div className={cn('flex items-center justify-center px-4 py-8', VARIANT_WRAPPERS[variant], className)}>
      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="absolute inset-x-0 top-2 mx-auto h-32 w-32 rounded-full bg-primary/12 blur-3xl" />
        <div className={cn('relative flex items-center justify-center', config.shell)}>
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '2.2s' }} />
          <div className="absolute inset-3 rounded-full border border-primary/25 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.24s' }} />
          <div className="absolute inset-[1.05rem] rounded-full border-2 border-primary/15 border-t-primary animate-spin" style={{ animationDuration: '1.6s' }} />
          <div className="relative flex h-[70%] w-[70%] items-center justify-center rounded-full border border-white/40 bg-card shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:border-white/10">
            <img src="/images/logo.png" alt="Workspace logo" className={cn('object-cover shadow-sm', config.logo)} />
          </div>
        </div>

        <div className="relative mt-6 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/75">Workspace</p>
          <h3 className={cn('font-black tracking-tight text-foreground', config.title)}>{title}</h3>
          <p className={cn('mx-auto max-w-sm font-medium text-muted-foreground', config.description)}>{description}</p>
        </div>

        <div className="relative mt-5 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/80 animate-pulse" style={{ animationDelay: '160ms' }} />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '320ms' }} />
        </div>
      </div>
    </div>
  );
};

export default BrandedLoader;
