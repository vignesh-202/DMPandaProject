import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative group">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-primary">
              {leftIcon}
            </div>
          )}
          <input
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            id={inputId}
            className={cn(
              "w-full h-11 px-4 py-2.5 text-sm",
              "bg-input text-foreground placeholder:text-muted-foreground",
              "border border-border rounded-xl",
              "transition-all duration-200",
              "hover:border-border-hover",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
              "focus:bg-input-focus",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
              error && "border-destructive focus:border-destructive focus:ring-destructive/20",
              leftIcon && "pl-11",
              (rightIcon || isPassword) && "pr-11",
              className
            )}
            ref={ref}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : rightIcon ? (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {rightIcon}
            </div>
          ) : null}
        </div>
        {error && (
          <p className="mt-2 text-xs text-destructive font-medium">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea Component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={textareaId}
            className="block text-sm font-medium text-foreground mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            "w-full min-h-[100px] px-4 py-3 text-sm resize-y",
            "bg-input text-foreground placeholder:text-muted-foreground",
            "border border-border rounded-xl",
            "transition-all duration-200",
            "hover:border-border-hover",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
            "focus:bg-input-focus",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
            error && "border-destructive focus:border-destructive focus:ring-destructive/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-2 text-xs text-destructive font-medium">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Input, Textarea };
