import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ToggleSwitchProps {
  isChecked: boolean;
  onChange: () => void;
  variant?: 'theme' | 'plain';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  isChecked, 
  onChange, 
  variant = 'theme',
  size = 'md',
  disabled = false
}) => {
  const sizes = {
    sm: {
      track: 'w-10 h-5',
      thumb: 'w-4 h-4',
      translate: isChecked ? 'translate-x-5' : 'translate-x-0.5',
      icon: 12,
    },
    md: {
      track: 'w-12 h-6',
      thumb: 'w-5 h-5',
      translate: isChecked ? 'translate-x-6' : 'translate-x-0.5',
      icon: 14,
    },
    lg: {
      track: 'w-14 h-7',
      thumb: 'w-6 h-6',
      translate: isChecked ? 'translate-x-7' : 'translate-x-0.5',
      icon: 16,
    },
  };

  const s = sizes[size];

  return (
    <label className={cn(
      "relative inline-flex items-center cursor-pointer",
      disabled && "cursor-not-allowed opacity-50"
    )}>
      <input 
        type="checkbox" 
        checked={isChecked} 
        onChange={onChange} 
        disabled={disabled}
        className="sr-only peer" 
      />
      <div className={cn(
        s.track,
        "relative rounded-full transition-all duration-300 ease-out",
        variant === 'theme'
          ? isChecked 
            ? "bg-gradient-to-r from-ig-purple to-ig-blue" 
            : "bg-gradient-to-r from-ig-yellow to-ig-orange"
          : isChecked 
            ? "bg-gradient-to-r from-ig-purple to-ig-blue" 
            : "bg-muted"
      )}>
        <div className={cn(
          s.thumb,
          s.translate,
          "absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transform transition-all duration-300 ease-out flex items-center justify-center"
        )}>
          {variant === 'theme' && (
            isChecked 
              ? <Moon size={s.icon} className="text-ig-purple" /> 
              : <Sun size={s.icon} className="text-ig-yellow" />
          )}
        </div>
      </div>
    </label>
  );
};

export default ToggleSwitch;
