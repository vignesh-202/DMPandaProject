"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Card from '../../components/ui/card';
import Gauge from '../../components/ui/gauge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { Calendar, Download, RefreshCw, Info, Users, BarChart3, TrendingUp, AlertCircle, ChevronRight, Loader2, X, ChevronLeft, Check, Activity, FileText, Zap, Clock } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';

/**
 * AnalyticsView Component - REDESIGNED
 *
 * Dashboard-style analytics with gauges at top, followed by graphs and automation logs.
 * - Dashboard gauges for quick overview
 * - Interactive charts and performance metrics
 * - Automation activity logs
 * - Optimized data fetching and caching
 */
const AnalyticsView: React.FC = () => {
    const {
        activeAccountID,
        analyticsCache: cache,
        setAnalyticsCache: setCache,
        analyticsLoading: loadingStates,
        setAnalyticsLoading: setLoadingStates,
        analyticsDateRange,
        setAnalyticsDateRange
    } = useDashboard();
    const { authenticatedFetch } = useAuth();

    const { start: startDate, end: endDate } = analyticsDateRange;

    // UI States
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState('reach');
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Filter states (Local buffers for the date picker)
    const [tempStartDate, setTempStartDate] = useState(startDate);
    const [tempEndDate, setTempEndDate] = useState(endDate);

    // Scroll to top when analytics page opens
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    // Sync temp dates with global dates when popover opens
    useEffect(() => {
        if (showDatePicker) {
            setTempStartDate(startDate);
            setTempEndDate(endDate);
        }
    }, [showDatePicker, startDate, endDate]);

    // Close date picker on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Mock data for demonstration - in real implementation, this would come from API
    const getChartData = () => {
        return [
            { name: 'Jan', value: 1200 },
            { name: 'Feb', value: 1800 },
            { name: 'Mar', value: 2400 },
            { name: 'Apr', value: 2100 },
            { name: 'May', value: 2800 },
            { name: 'Jun', value: 3200 },
        ];
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 select-text">
            {/* DASHBOARD-STYLE GAUGES AT TOP */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'DM Rate', value: 15, max: 100, icon: TrendingUp },
                    { label: 'Actions/Mo', value: 4500, max: 10000, icon: Activity },
                    { label: 'Reel Replies', value: 72, max: 100, icon: FileText },
                    { label: 'Post Replies', value: 85, max: 100, icon: FileText },
                ].map((gauge, index) => (
                    <Card
                        key={index}
                        variant="elevated"
                        className="relative flex flex-col aspect-[4/5] sm:aspect-square group hover:shadow-lg transition-shadow"
                    >
                        {/* Title */}
                        <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10">
                            <h3 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                                {gauge.label}
                            </h3>
                        </div>

                        {/* Gauge - Centered */}
                        <div className="flex-1 flex items-center justify-center pt-4">
                            <Gauge
                                value={gauge.value}
                                max={gauge.max}
                                size="lg"
                                syncId="analytics-gauges"
                            />
                        </div>
                    </Card>
                ))}
            </div>

            {/* PERFORMANCE CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main Performance Chart */}
                <Card className="p-8 border border-content shadow-sm rounded-[2rem]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            Performance Trends
                        </h3>
                        <div className="flex gap-2">
                            {['reach', 'engagement', 'growth'].map(metric => (
                                <button
                                    key={metric}
                                    onClick={() => setSelectedMetric(metric)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                        selectedMetric === metric
                                            ? 'bg-blue-500 text-white shadow-lg'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {metric}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getChartData()}>
                                <defs>
                                    <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="rgb(var(--ig-blue))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="rgb(var(--ig-blue))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" opacity={0.5} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgb(var(--muted-foreground))' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'rgb(var(--muted-foreground))' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                                    cursor={{ stroke: 'rgb(var(--ig-blue))', strokeWidth: 2 }}
                                />
                                <Area type="monotone" dataKey="value" stroke="rgb(var(--ig-blue))" strokeWidth={3} fill="url(#analyticsGradient)" animationDuration={2000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Automation Activity Log */}
                <Card className="p-8 border border-content shadow-sm rounded-[2rem]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            Automation Activity
                        </h3>
                        <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {[
                            { time: '2 hours ago', action: 'DM Automation triggered', target: 'john_doe', status: 'success' },
                            { time: '4 hours ago', action: 'Reel comment reply', target: '@fashion_blog', status: 'success' },
                            { time: '6 hours ago', action: 'Post automation sent', target: 'sarah_styles', status: 'success' },
                            { time: '8 hours ago', action: 'Story mention reply', target: '@tech_guru', status: 'success' },
                            { time: '10 hours ago', action: 'Keyword automation', target: 'mike_photos', status: 'success' },
                            { time: '12 hours ago', action: 'DM follow-up sent', target: 'emma_art', status: 'success' },
                        ].map((activity, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <div className={`w-2 h-2 rounded-full ${activity.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{activity.action}</p>
                                    <p className="text-xs text-gray-500">{activity.target} • {activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* ADDITIONAL ANALYTICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Engagement Breakdown */}
                <Card className="p-6 border border-content shadow-sm rounded-[2rem]">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">
                            Engagement Breakdown
                        </h4>
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'Likes', value: 1247, color: 'bg-red-500' },
                            { label: 'Comments', value: 89, color: 'bg-blue-500' },
                            { label: 'Shares', value: 23, color: 'bg-green-500' },
                            { label: 'Saves', value: 156, color: 'bg-amber-500' },
                        ].map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{item.label}</span>
                                <span className="text-sm font-black text-gray-900 dark:text-white">{item.value.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Growth Metrics */}
                <Card className="p-6 border border-content shadow-sm rounded-[2rem]">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">
                            Growth Metrics
                        </h4>
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'New Followers', value: 342, change: '+12%', positive: true },
                            { label: 'Profile Visits', value: 2156, change: '+8%', positive: true },
                            { label: 'Unfollows', value: 23, change: '-2%', positive: false },
                        ].map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{item.label}</span>
                                <div className="text-right">
                                    <span className="text-sm font-black text-gray-900 dark:text-white block">{item.value.toLocaleString()}</span>
                                    <span className={`text-xs font-bold ${item.positive ? 'text-green-500' : 'text-red-500'}`}>{item.change}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Top Performing Content */}
                <Card className="p-6 border border-content shadow-sm rounded-[2rem]">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">
                            Top Content
                        </h4>
                        <Zap className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="space-y-3">
                        {[
                            { type: 'Reel', engagement: '2.3K', time: '2 days ago' },
                            { type: 'Post', engagement: '1.8K', time: '5 days ago' },
                            { type: 'Story', engagement: '945', time: '1 day ago' },
                        ].map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{item.type}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-black text-gray-900 dark:text-white">{item.engagement}</span>
                                    <span className="text-xs text-gray-400 block">{item.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AnalyticsView;