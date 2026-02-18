import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
    // Base styles
    cn(
        'inline-flex items-center justify-center gap-2',
        'font-semibold text-sm',
        'rounded-xl',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        'active:scale-[0.98]'
    ),
    {
        variants: {
            variant: {
                // Primary - Instagram Pink/Magenta gradient
                default: cn(
                    'bg-instagram-gradient-primary',
                    'text-white',
                    'shadow-instagram',
                    'hover:shadow-instagram-lg hover:-translate-y-0.5',
                    'hover:brightness-110'
                ),
                // Secondary - Subtle background
                secondary: cn(
                    'bg-light-bg dark:bg-dark-card',
                    'text-light-text dark:text-dark-text',
                    'border border-light-border dark:border-dark-border',
                    'hover:bg-light-borderLight dark:hover:bg-dark-cardHover',
                    'hover:border-light-textSecondary dark:hover:border-dark-textSecondary'
                ),
                // Outline - Border only
                outline: cn(
                    'bg-transparent',
                    'border border-light-border dark:border-dark-border',
                    'text-light-text dark:text-dark-text',
                    'hover:bg-light-bg dark:hover:bg-dark-bgSecondary',
                    'hover:border-primary-500 hover:text-primary-500'
                ),
                // Ghost - No background
                ghost: cn(
                    'bg-transparent',
                    'text-light-textSecondary dark:text-dark-textSecondary',
                    'hover:bg-light-bg dark:hover:bg-dark-card',
                    'hover:text-light-text dark:hover:text-dark-text'
                ),
                // Destructive - Red/Danger
                destructive: cn(
                    'bg-red-500',
                    'text-white',
                    'hover:bg-red-600',
                    'shadow-sm hover:shadow-md'
                ),
                // Instagram Gradient Button - Full spectrum
                instagram: cn(
                    'bg-instagram-gradient',
                    'bg-[length:200%_100%]',
                    'animate-gradient-shift',
                    'text-white font-semibold',
                    'shadow-instagram-lg',
                    'hover:shadow-glow-pink hover:-translate-y-0.5'
                ),
                // Link style
                link: cn(
                    'bg-transparent',
                    'text-primary-500',
                    'underline-offset-4 hover:underline',
                    'p-0 h-auto'
                ),
                // Success
                success: cn(
                    'bg-green-500',
                    'text-white',
                    'hover:bg-green-600',
                    'shadow-sm hover:shadow-md'
                ),
            },
            size: {
                default: 'h-11 px-5',
                sm: 'h-9 px-4 text-xs',
                lg: 'h-12 px-8 text-base',
                xl: 'h-14 px-10 text-lg',
                icon: 'h-10 w-10 p-0',
                iconSm: 'h-8 w-8 p-0',
                iconLg: 'h-12 w-12 p-0',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="opacity-70">{children}</span>
                    </>
                ) : (
                    <>
                        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                        {children}
                        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
                    </>
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';

// Icon Button Component
interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon'> {
    icon: React.ReactNode;
    'aria-label': string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ icon, className, size = 'icon', variant = 'ghost', ...props }, ref) => {
        return (
            <Button
                ref={ref}
                variant={variant}
                size={size}
                className={cn('flex-shrink-0', className)}
                {...props}
            >
                {icon}
            </Button>
        );
    }
);

IconButton.displayName = 'IconButton';

export { Button, IconButton, buttonVariants };
