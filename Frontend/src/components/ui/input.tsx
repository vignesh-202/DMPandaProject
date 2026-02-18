import React from 'react';
import { cn } from '../../lib/utils';

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
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none transition-colors group-focus-within:text-ig-purple dark:group-focus-within:text-purple-400">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              "w-full h-11 px-4 py-2.5 text-sm",
              "bg-input text-foreground placeholder:text-muted-foreground",
              "border border-border rounded-xl",
              "transition-all duration-200",
              "hover:border-gray-400 dark:hover:border-gray-500",
              "focus:outline-none focus:border-ig-purple dark:focus:border-purple-400 focus:ring-3 focus:ring-ig-purple/15 dark:focus:ring-purple-400/20",
              "focus:bg-white dark:focus:bg-card",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted",
              error && "border-destructive focus:border-destructive focus:ring-destructive/20",
              leftIcon && "pl-11",
              rightIcon && "pr-11",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              {rightIcon}
            </div>
          )}
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
            "focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/15",
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
