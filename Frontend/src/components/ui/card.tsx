import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const Card = React.memo(({ children, className, ...props }: CardProps) => {
  return (
    <div className={`shadow-md rounded-md p-4 ${className}`} style={{ backgroundColor: 'var(--card-background)' }} {...props}>
      {children}
    </div>
  );
});

export default Card;
