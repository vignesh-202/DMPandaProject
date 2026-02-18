import React from 'react';
import { cn } from '../../lib/utils';

interface AuthVerifyingScreenProps {
  /** Message shown below the loader, e.g. "Verifying session..." or "Redirecting to dashboard..." */
  text?: string;
  className?: string;
}

/**
 * Full-screen, modern loading screen for auth verification (e.g. on /login).
 * Shows while checking if the user is already logged in; then either the login form or a redirect.
 */
const AuthVerifyingScreen: React.FC<AuthVerifyingScreenProps> = ({
  text = 'Verifying session...',
  className,
}) => {
  return (
    <div
      className={cn(
        'min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden',
        'bg-[rgb(var(--background))]',
        className
      )}
    >
      {/* Ambient gradient orbs */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute top-1/4 -left-24 w-80 h-80 rounded-full blur-3xl bg-[rgb(var(--primary))]/[0.12] animate-float"
          style={{ animationDelay: '0s', animationDuration: '5s' }}
        />
        <div
          className="absolute top-1/3 -right-20 w-72 h-72 rounded-full blur-3xl bg-ig-pink/10 animate-float"
          style={{ animationDelay: '1.2s', animationDuration: '6s' }}
        />
        <div
          className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl bg-ig-blue/10 animate-float"
          style={{ animationDelay: '2.5s', animationDuration: '5.5s' }}
        />
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center animate-fadeIn">
        {/* Pulse glow (behind) + gradient ring + logo */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full animate-ig-pulse"
            aria-hidden
          />
          <div className="ig-story-ring-animated w-28 h-28 rounded-full overflow-hidden flex items-center justify-center">
            <div className="rounded-full bg-[rgb(var(--card))] w-full h-full flex items-center justify-center">
              <img
                src="/images/logo.png"
                alt="DM Panda"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        {/* Text and dots */}
        <p className="mt-6 text-[rgb(var(--muted-foreground))] text-sm font-medium flex items-center gap-1">
          <span className="animate-pulse">{text}</span>
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-fast opacity-70" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-fast-delay opacity-70" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-fast-delay-2 opacity-70" />
          </span>
        </p>
      </div>
    </div>
  );
};

export default AuthVerifyingScreen;
