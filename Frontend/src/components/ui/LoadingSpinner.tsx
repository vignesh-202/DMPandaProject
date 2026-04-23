import React from 'react';

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = "Panda is working...",
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center h-full min-h-[400px] animate-fadeIn ${className}`}>
      <div className="relative">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        {/* Panda Animation */}
        <img
          src="/images/loading_panda.gif"
          alt="Loading..."
          className="relative z-10 h-56 w-56 drop-shadow-lg sm:h-64 sm:w-64"
        />
      </div>
      {/* Loading Text */}
      <div className="mt-5 text-center">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.22em] animate-pulse">
          {text}
        </p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
