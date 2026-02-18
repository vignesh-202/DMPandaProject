import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModernLoaderProps {
  className?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'muted';
}

const ModernLoader: React.FC<ModernLoaderProps> = ({ 
  className = "", 
  text = "Loading...", 
  size = 'md', 
  variant = 'primary' 
}) => {
  const sizes = {
    sm: { icon: "w-4 h-4", container: "w-8 h-8" },
    md: { icon: "w-6 h-6", container: "w-12 h-12" },
    lg: { icon: "w-10 h-10", container: "w-16 h-16" }
  };

  const variants = {
    default: "text-foreground",
    primary: "text-primary",
    muted: "text-muted-foreground"
  };

  return (
    <div className={cn("flex flex-col items-center justify-center w-full min-h-[50px]", className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer ping ring */}
        <div className={cn(
          "absolute rounded-full border-2 border-current opacity-20 animate-ping",
          sizes[size].container,
          variants[variant]
        )} />
        {/* Spinner */}
        <Loader2 className={cn(
          "animate-spin relative z-10",
          sizes[size].icon,
          variants[variant]
        )} />
      </div>
      {text && (
        <span className="mt-4 text-2xs font-semibold text-muted-foreground animate-pulse uppercase tracking-widest">
          {text}
        </span>
      )}
    </div>
  );
};

export default ModernLoader;
