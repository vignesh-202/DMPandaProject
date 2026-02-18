import React, { useEffect, useState } from 'react';
import httpClient from '../lib/httpClient';
import { Loader2, Users, DollarSign, Activity, Zap, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../lib/utils';

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        paidUsers: 0,
        newUsers24h: 0,
        mrr: 0,
        activeCampaigns: 0,
        automationsRan: 0
    });
    const [recentUsers, setRecentUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Mock Data for Charts (Keep until backend provides history)
    const growthData = [
        { name: 'Jan', users: 400, revenue: 2400 },
        { name: 'Feb', users: 600, revenue: 3200 },
        { name: 'Mar', users: 900, revenue: 4500 },
        { name: 'Apr', users: 1200, revenue: 6000 },
        { name: 'May', users: 1800, revenue: 8500 },
        { name: 'Jun', users: 2400, revenue: 12000 },
    ];

    const planDistribution = [
        { name: 'Free', value: 70 },
        { name: 'Premium Monthly', value: 20 },
        { name: 'Premium Yearly', value: 10 },
    ];
    const COLORS = ['#e5e7eb', '#525252', '#000000'];

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await httpClient.get('/admin/dashboard');
                if (response.data?.stats) {
                    setStats(response.data.stats);
                    setRecentUsers(response.data.recentUsers || []);
                }
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const StatCard = ({ title, value, icon: Icon, trend }: any) => (
        <div className="group bg-white dark:bg-[#0A0A0A] p-7 rounded-[24px] border border-gray-100 dark:border-neutral-800/50 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.02)] hover:-translate-y-1">
            <div className="flex justify-between items-start mb-5">
                <div className={cn(
                    "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
                    "bg-gray-50 dark:bg-neutral-800/50 group-hover:bg-black dark:group-hover:bg-white"
                )}>
                    <Icon className="w-5 h-5 text-black dark:text-white group-hover:text-white dark:group-hover:text-black transition-colors" />
                </div>
                {trend && (
                    <div className="flex items-center text-[10px] font-bold tracking-wider uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/20">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        {trend}
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">{value}</h3>
                <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">{title}</p>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="animate-spin w-10 h-10 text-black dark:text-white opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 animate-pulse">Loading Analytics...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Overview</h1>
                    <p className="text-gray-500 dark:text-neutral-400 mt-2 font-medium">Real-time performance metrics and platform growth.</p>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="inline-flex items-center space-x-2 bg-white dark:bg-neutral-900 px-4 py-2 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Live Updates</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Users"
                    value={stats.totalUsers.toLocaleString()}
                    icon={Users}
                    trend="+12%"
                />
                <StatCard
                    title="Monthly Revenue"
                    value={`$${stats.mrr.toLocaleString()}`}
                    icon={DollarSign}
                    trend="+8.2%"
                />
                <StatCard
                    title="Active Automations"
                    value={stats.automationsRan.toLocaleString()}
                    icon={Zap}
                    trend="+24%"
                />
                <StatCard
                    title="Engagement Rate"
                    value="84.2%"
                    icon={Activity}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Growth Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-[#0A0A0A] p-8 rounded-[32px] border border-gray-100 dark:border-neutral-800/50 shadow-sm">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Growth & Revenue</h3>
                            <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Acquisition vs Revenue</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800 text-[10px] font-bold">
                                <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                                <span className="text-gray-600 dark:text-neutral-400">Users</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800 text-[10px] font-bold">
                                <div className="w-2 h-2 rounded-full bg-neutral-400" />
                                <span className="text-gray-600 dark:text-neutral-400">Revenue</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000000" stopOpacity={0.05} />
                                        <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#666666" stopOpacity={0.05} />
                                        <stop offset="95%" stopColor="#666666" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        backgroundColor: 'rgba(0,0,0,0.8)',
                                        backdropFilter: 'blur(8px)',
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        color: 'white'
                                    }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="users"
                                    stroke="#000000"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorUsers)"
                                    className="dark:stroke-white dark:fill-white/10"
                                    animationDuration={1500}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#737373"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* User Distribution */}
                <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-[32px] border border-gray-100 dark:border-neutral-800/50 shadow-sm flex flex-col">
                    <div className="mb-8">
                        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Plans</h3>
                        <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Tier distribution</p>
                    </div>
                    <div className="flex-1 min-h-[250px] w-full flex flex-col items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={planDistribution}
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={8}
                                    dataKey="value"
                                    animationDuration={1500}
                                >
                                    {planDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                            <span className="text-2xl font-black text-gray-900 dark:text-white">100%</span>
                            <span className="text-[8px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Total Users</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 mt-6">
                        {planDistribution.map((entry, index) => (
                            <div key={entry.name} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-neutral-800/40 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index] }}></div>
                                    <span className="text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">{entry.name}</span>
                                </div>
                                <span className="text-xs font-black text-gray-900 dark:text-white">{entry.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Signups Table */}
            <div className="bg-white dark:bg-[#0A0A0A] rounded-[32px] border border-gray-100 dark:border-neutral-800/50 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-gray-50 dark:border-neutral-800/50 flex justify-between items-center bg-gray-50/30 dark:bg-neutral-800/10">
                    <div>
                        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Recent Signups</h3>
                        <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Latest users joining the platform</p>
                    </div>
                    <button className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity">
                        View All
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-50 dark:border-neutral-800/30">
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">User Details</th>
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Joined Date</th>
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest text-right">Plan Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/30">
                            {recentUsers.map((user, i) => (
                                <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-neutral-800/20 transition-all duration-200">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center text-gray-600 dark:text-neutral-300 font-black text-xs border border-white dark:border-neutral-800 shadow-sm group-hover:scale-110 transition-transform">
                                                {user.name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-black dark:group-hover:text-white">{user.name}</p>
                                                <p className="text-[10px] font-medium text-gray-500 dark:text-neutral-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={cn(
                                            "inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                                            user.status === 'Active'
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/20"
                                                : "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/20"
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full mr-2", user.status === 'Active' ? "bg-emerald-500" : "bg-red-500")} />
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-xs font-bold text-gray-600 dark:text-neutral-400">
                                        {new Date(user.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="text-xs font-black text-gray-900 dark:text-white">{user.amount || '$0.00'}</span>
                                    </td>
                                </tr>
                            ))}
                            {recentUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-10 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2 opacity-50">
                                            <Users className="w-8 h-8 text-gray-300" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">No recent signups</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
