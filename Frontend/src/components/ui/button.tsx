import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97] select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        // Default - Instagram Gradient Theme (Matching Home Page Login/Dashboard button)
        default: 'bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-sm hover:shadow-lg hover:shadow-[#833AB4]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200',
        // Instagram Gradient - Primary action button
        instagram: 'bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-lg hover:shadow-lg hover:shadow-[#833AB4]/30 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300',
        // Destructive
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md',
        // Outline with Instagram hover effect
        outline: 'border-2 border-border bg-transparent hover:bg-ig-purple/5 hover:border-ig-purple/30 text-foreground',
        // Secondary
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        // Ghost with Instagram hover
        ghost: 'hover:bg-ig-purple/10 hover:text-ig-purple text-muted-foreground',
        // Link
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none hover:text-ig-purple',
        // Success
        success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm hover:shadow-md',
        // Warning - Instagram Yellow
        warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm hover:shadow-md',
        // Instagram Outline - Gradient border
        'instagram-outline': 'bg-transparent text-foreground hover:text-ig-purple border-2 border-transparent bg-clip-padding relative before:absolute before:inset-0 before:rounded-xl before:p-[2px] before:bg-gradient-to-r before:from-[#405DE6] before:via-[#833AB4] before:to-[#FD1D1D] before:-z-10 before:content-[""] hover:shadow-lg',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-4 text-xs rounded-lg',
        lg: 'h-12 px-6 text-base rounded-xl',
        xl: 'h-14 px-8 text-base rounded-2xl',
        icon: 'h-10 w-10 p-0 rounded-xl',
        'icon-sm': 'h-8 w-8 p-0 rounded-lg',
        'icon-lg': 'h-12 w-12 p-0 rounded-xl',
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
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{children}</span>
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

export { Button, buttonVariants };
