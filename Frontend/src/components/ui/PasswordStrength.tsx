import React from 'react';

export const calculateStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length > 7) strength++;
    if (pwd.match(/[a-z]/) && pwd.match(/[A-Z]/)) strength++;
    if (pwd.match(/\d/)) strength++;
    if (pwd.match(/[^a-zA-Z\d]/)) strength++;
    return strength;
};

export const getStrengthLabel = (strength: number) => {
    if (strength === 0) return 'Very Weak';
    if (strength === 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Good';
    return 'Strong';
};

export const getStrengthColor = (strength: number) => {
    if (strength === 0) return 'bg-red-500';
    if (strength === 1) return 'bg-red-400';
    if (strength === 2) return 'bg-yellow-500';
    if (strength === 3) return 'bg-blue-500';
    return 'bg-green-500';
};

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
    if (!password) return null;
    const strength = calculateStrength(password);
    const label = getStrengthLabel(strength);
    const color = getStrengthColor(strength);
    const textColor = color.replace('bg-', 'text-');

    return (
        <div className="mt-3 relative z-0">
            <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-medium ${textColor}`}>{label}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-300 ease-out`}
                    style={{ width: `${(strength + 1) * 20}%` }}
                />
            </div>
        </div>
    );
};

export default PasswordStrengthIndicator;
