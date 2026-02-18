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
            ? "bg-gradient-to-r from-[#833AB4] to-[#405DE6]" 
            : "bg-gradient-to-r from-[#FCAF45] to-[#F56040]"
          : isChecked 
            ? "bg-gradient-to-r from-[#833AB4] to-[#405DE6]" 
            : "bg-muted"
      )}>
        <div className={cn(
          s.thumb,
          s.translate,
          "absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transform transition-all duration-300 ease-out flex items-center justify-center"
        )}>
          {variant === 'theme' && (
            isChecked 
              ? <Moon size={s.icon} className="text-[#833AB4]" /> 
              : <Sun size={s.icon} className="text-[#FCAF45]" />
          )}
        </div>
      </div>
    </label>
  );
};

export default ToggleSwitch;
