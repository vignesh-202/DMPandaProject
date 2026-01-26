import React from 'react';
import Card from '../../components/ui/card';

interface PlaceholderViewProps {
    title: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6">{title}</h2>
            <Card>
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <h3 className="text-xl font-semibold mb-2 text-black dark:text-white">Coming Soon</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        The {title} feature is currently under development.
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default PlaceholderView;
