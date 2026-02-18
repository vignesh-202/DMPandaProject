import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    success?: boolean;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    inputSize?: 'sm' | 'md' | 'lg';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ 
        className, 
        type, 
        label, 
        error, 
        success,
        hint, 
        leftIcon, 
        rightIcon,
        inputSize = 'md',
        disabled,
        ...props 
    }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const [isFocused, setIsFocused] = useState(false);
        const isPassword = type === 'password';

        const sizeClasses = {
            sm: 'h-9 text-sm px-3',
            md: 'h-11 text-sm px-4',
            lg: 'h-12 text-base px-5'
        };

        const iconSizeClasses = {
            sm: 'h-4 w-4',
            md: 'h-4 w-4',
            lg: 'h-5 w-5'
        };

        return (
            <div className="w-full space-y-1.5">
                {/* Label */}
                {label && (
                    <label 
                        className={cn(
                            "block text-xs font-semibold uppercase tracking-wide transition-colors duration-200",
                            isFocused ? "text-primary-500" : "text-light-textSecondary dark:text-dark-textSecondary",
                            error && "text-red-500",
                            success && "text-green-500"
                        )}
                    >
                        {label}
                    </label>
                )}
                
                {/* Input Container */}
                <div className="relative group">
                    {/* Left Icon */}
                    {leftIcon && (
                        <div className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200",
                            isFocused ? "text-primary-500" : "text-light-textMuted dark:text-dark-textMuted",
                            error && "text-red-500",
                            success && "text-green-500"
                        )}>
                            {leftIcon}
                        </div>
                    )}

                    {/* Input Field */}
                    <input
                        type={isPassword ? (showPassword ? 'text' : 'password') : type}
                        className={cn(
                            // Base styles
                            'w-full rounded-xl font-medium',
                            'transition-all duration-200 ease-out',
                            
                            // Background
                            'bg-light-bg dark:bg-dark-bgSecondary',
                            
                            // Border
                            'border-2',
                            isFocused 
                                ? 'border-primary-500 dark:border-primary-500' 
                                : 'border-light-border dark:border-dark-border',
                            error && 'border-red-500 dark:border-red-500',
                            success && 'border-green-500 dark:border-green-500',
                            
                            // Focus ring
                            'focus:outline-none',
                            isFocused && !error && !success && 'ring-4 ring-primary-500/10',
                            error && 'ring-4 ring-red-500/10',
                            success && 'ring-4 ring-green-500/10',
                            
                            // Text
                            'text-light-text dark:text-dark-text',
                            'placeholder:text-light-textMuted dark:placeholder:text-dark-textMuted',
                            
                            // Size
                            sizeClasses[inputSize],
                            
                            // Padding adjustments for icons
                            leftIcon && 'pl-11',
                            (isPassword || rightIcon || error || success) && 'pr-11',
                            
                            // Hover state
                            'hover:border-light-textSecondary dark:hover:border-dark-textSecondary',
                            
                            // Disabled state
                            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-light-border dark:disabled:hover:border-dark-border',
                            
                            className
                        )}
                        ref={ref}
                        disabled={disabled}
                        onFocus={(e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }}
                        {...props}
                    />

                    {/* Right Side - Password Toggle / Icon / Status */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {/* Error Icon */}
                        {error && !isPassword && (
                            <AlertCircle className={cn(iconSizeClasses[inputSize], "text-red-500")} />
                        )}
                        
                        {/* Success Icon */}
                        {success && !isPassword && !error && (
                            <Check className={cn(iconSizeClasses[inputSize], "text-green-500")} />
                        )}

                        {/* Custom Right Icon */}
                        {rightIcon && !isPassword && !error && !success && (
                            <span className="text-light-textMuted dark:text-dark-textMuted">
                                {rightIcon}
                            </span>
                        )}

                        {/* Password Toggle */}
                        {isPassword && (
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={cn(
                                    "p-1.5 rounded-lg transition-all duration-200",
                                    "text-light-textSecondary dark:text-dark-textSecondary",
                                    "hover:text-light-text dark:hover:text-dark-text",
                                    "hover:bg-light-borderLight dark:hover:bg-dark-cardHover",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                )}
                                tabIndex={-1}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <EyeOff className={cn(iconSizeClasses[inputSize], "opacity-80")} />
                                ) : (
                                    <Eye className={cn(iconSizeClasses[inputSize], "opacity-80")} />
                                )}
                            </button>
                        )}
                    </div>

                    {/* Focus indicator line */}
                    <div className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300",
                        "bg-gradient-to-r from-instagram-violet via-instagram-pink to-instagram-orange",
                        isFocused && !error && !success ? "w-full opacity-100" : "w-0 opacity-0"
                    )} />
                </div>

                {/* Error Message */}
                {error && (
                    <p className="text-xs font-medium text-red-500 flex items-center gap-1.5 animate-fade-in">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                    </p>
                )}

                {/* Hint Text */}
                {hint && !error && (
                    <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

// Search Input Variant
interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
    onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    ({ className, onClear, value, ...props }, ref) => {
        return (
            <Input
                ref={ref}
                type="search"
                leftIcon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                }
                rightIcon={
                    value && onClear ? (
                        <button
                            type="button"
                            onClick={onClear}
                            className="p-1 rounded-full hover:bg-light-borderLight dark:hover:bg-dark-cardHover transition-colors"
                        >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    ) : undefined
                }
                value={value}
                className={cn("pl-11", className)}
                {...props}
            />
        );
    }
);

SearchInput.displayName = 'SearchInput';

export { Input, SearchInput };
