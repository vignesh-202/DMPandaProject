import React from 'react';
import { Loader2 } from 'lucide-react';

interface ModernLoaderProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    variant?: 'white' | 'black' | 'primary';
}

const ModernLoader: React.FC<ModernLoaderProps> = ({
    size = 'md',
    className = '',
    variant = 'white'
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    const variantClasses = {
        white: 'text-white',
        black: 'text-black',
        primary: 'text-blue-600'
    };

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <Loader2 className={`animate-spin ${sizeClasses[size]} ${variantClasses[variant]}`} />
        </div>
    );
};

export default ModernLoader;
