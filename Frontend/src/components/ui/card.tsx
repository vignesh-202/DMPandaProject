import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'ghost' | 'interactive' | 'instagram' | 'instagram-solid';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = React.memo(({ 
  children, 
  className, 
  variant = 'default',
  padding = 'md',
  ...props 
}: CardProps) => {
  const baseStyles = "rounded-2xl transition-all duration-200 relative overflow-hidden";
  
  const variants = {
    default: "ig-card hover:shadow-md",
    elevated: "ig-card shadow-md hover:shadow-lg",
    ghost: "bg-transparent border border-transparent",
    interactive: "ig-card hover:shadow-lg hover:border-ig-purple/20 cursor-pointer active:scale-[0.99] hover:-translate-y-0.5",
    // New Instagram-themed variants
    instagram: "bg-card border-2 border-transparent shadow-md hover:shadow-instagram relative before:absolute before:inset-0 before:rounded-2xl before:p-[2px] before:bg-ig-gradient before:-z-10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
    'instagram-solid': "bg-ig-gradient text-white shadow-lg hover:shadow-ig-glow",
  };

  const paddings = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-6 lg:p-7",
  };

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

// Card Header
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const CardHeader = React.memo(({ children, className, ...props }: CardHeaderProps) => {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
});

CardHeader.displayName = 'CardHeader';

// Card Title
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  className?: string;
}

const CardTitle = React.memo(({ children, className, ...props }: CardTitleProps) => {
  return (
    <h3
      className={cn("text-lg font-semibold text-foreground tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
});

CardTitle.displayName = 'CardTitle';

// Card Description
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  className?: string;
}

const CardDescription = React.memo(({ children, className, ...props }: CardDescriptionProps) => {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
});

CardDescription.displayName = 'CardDescription';

// Card Content
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const CardContent = React.memo(({ children, className, ...props }: CardContentProps) => {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
});

CardContent.displayName = 'CardContent';

// Card Footer
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const CardFooter = React.memo(({ children, className, ...props }: CardFooterProps) => {
  return (
    <div
      className={cn("flex items-center pt-4 mt-auto border-t border-border", className)}
      {...props}
    >
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';

export default Card;
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
