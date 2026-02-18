import React from 'react';
import Card from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useDashboard } from '../../contexts/DashboardContext';
import { Users, UserPlus, Image, PlaySquare } from 'lucide-react';

const StatsRow = () => {
    const { activeAccountStats: stats, isLoadingStats: loading } = useDashboard();

    const metrics = [
        { label: 'Followers', value: stats?.followers, icon: Users, color: 'text-blue-500' },
        { label: 'Following', value: stats?.following, icon: UserPlus, color: 'text-purple-500' },
        { label: 'Total Posts', value: stats?.media_count, icon: Image, color: 'text-pink-500' },
        { label: 'Reels', value: stats?.reels_count || 0, icon: PlaySquare, color: 'text-orange-500' },
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} variant="elevated" className="p-3 sm:p-4 flex items-center space-x-4 border border-border shadow-sm">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {metrics.map((metric, i) => (
                <Card key={i} variant="elevated" className="relative overflow-hidden p-3 sm:p-4 flex items-center border border-border shadow-sm hover:shadow-md dark:shadow-md transition-all group">
                    <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-gray-900 ${metric.color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
                        <metric.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${metric.color}`} />
                    </div>
                    <div className="ml-2 sm:ml-4">
                        <h4 className="text-base sm:text-lg md:text-xl font-black text-foreground tracking-tight">
                            {metric.value !== undefined ? metric.value.toLocaleString() : '0'}
                        </h4>
                        <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                            {metric.label}
                        </p>
                    </div>
                    {/* Decorative background blur */}
                    <div className={`absolute -right-4 -bottom-4 w-12 h-12 sm:w-16 sm:h-16 rounded-full blur-2xl opacity-10 ${metric.color.replace('text', 'bg')}`} />
                </Card>
            ))}
        </div>
    );
};

export default StatsRow;
