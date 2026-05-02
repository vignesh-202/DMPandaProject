import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'gradient' | 'ghost';
    hover?: boolean;
    glow?: boolean;
}

const Card = React.memo(({ 
    children, 
    className, 
    variant = 'default',
    hover = false,
    glow = false,
    ...props 
}: CardProps) => {
    const baseStyles = "rounded-2xl transition-all duration-300";
    
    const variantStyles = {
        default: cn(
            "bg-white dark:bg-dark-card",
            "border border-light-border dark:border-dark-border",
            "shadow-card-light dark:shadow-card-dark"
        ),
        gradient: cn(
            "bg-white dark:bg-dark-card",
            "ig-gradient-border"
        ),
        ghost: cn(
            "bg-transparent",
            "border border-light-borderLight dark:border-dark-borderLight"
        )
    };

    const hoverStyles = hover ? cn(
        "hover:shadow-card-hover-light dark:hover:shadow-card-hover-dark",
        "hover:border-light-borderLight dark:hover:border-dark-cardHover",
        "hover:-translate-y-0.5",
        "cursor-pointer"
    ) : "";

    const glowStyles = glow ? "animate-glow-pulse" : "";

    return (
        <div 
            className={cn(
                baseStyles,
                variantStyles[variant],
                hoverStyles,
                glowStyles,
                "p-6",
                className
            )} 
            {...props}
        >
            {children}
        </div>
    );
});

Card.displayName = 'Card';

// Card Header Component
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

const CardHeader = React.memo(({ children, className, ...props }: CardHeaderProps) => (
    <div className={cn("mb-4", className)} {...props}>
        {children}
    </div>
));

CardHeader.displayName = 'CardHeader';

// Card Title Component
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
    className?: string;
}

const CardTitle = React.memo(({ children, className, ...props }: CardTitleProps) => (
    <h3 
        className={cn(
            "text-lg font-semibold text-light-text dark:text-dark-text",
            className
        )} 
        {...props}
    >
        {children}
    </h3>
));

CardTitle.displayName = 'CardTitle';

// Card Description Component
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode;
    className?: string;
}

const CardDescription = React.memo(({ children, className, ...props }: CardDescriptionProps) => (
    <p 
        className={cn(
            "text-sm text-light-textSecondary dark:text-dark-textSecondary",
            className
        )} 
        {...props}
    >
        {children}
    </p>
));

CardDescription.displayName = 'CardDescription';

// Card Content Component
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

const CardContent = React.memo(({ children, className, ...props }: CardContentProps) => (
    <div className={cn("", className)} {...props}>
        {children}
    </div>
));

CardContent.displayName = 'CardContent';

// Card Footer Component
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

const CardFooter = React.memo(({ children, className, ...props }: CardFooterProps) => (
    <div className={cn("mt-4 pt-4 border-t border-light-borderLight dark:border-dark-borderLight", className)} {...props}>
        {children}
    </div>
));

CardFooter.displayName = 'CardFooter';

export default Card;
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
