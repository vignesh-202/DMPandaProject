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
          className="w-48 h-48 relative z-10 drop-shadow-lg" 
        />
      </div>
      {/* Loading Text */}
      <div className="mt-4 text-center">
        <p className="text-muted-foreground text-2xs font-semibold uppercase tracking-widest animate-pulse">
          {text}
        </p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
