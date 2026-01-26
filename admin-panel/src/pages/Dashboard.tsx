import React, { useEffect, useState } from 'react';
import httpClient from '../lib/httpClient';
import { Loader2, Users, DollarSign, Activity, Zap, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800 transition-all hover:shadow-lg dark:hover:shadow-neutral-800/50">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-neutral-800">
                    <Icon className="w-5 h-5 text-black dark:text-white" />
                </div>
                {trend && (
                    <div className="flex items-center text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        {trend}
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
            </div>
        </div>
    );

    if (loading) {
        return <Loader2 className="animate-spin w-8 h-8 text-black dark:text-white mx-auto mt-20" />;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Overview</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Performance metrics and platform usage</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Last updated</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date().toLocaleTimeString()}</p>
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
                    title="Avg. Engagement"
                    value="84%"
                    icon={Activity}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Growth Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Growth & Revenue</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">User acquisition vs Revenue over time</p>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#888888" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#888888" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="users" stroke="#000000" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" className="dark:stroke-white dark:fill-white/10" />
                                <Area type="monotone" dataKey="revenue" stroke="#A3A3A3" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* User Distribution */}
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-gray-100 dark:border-neutral-800">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plan Distribution</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Current user subscription tiers</p>
                    </div>
                    <div className="h-[300px] w-full flex flex-col items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={planDistribution}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {planDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center space-x-4 mt-4 text-xs font-medium">
                            {planDistribution.map((entry, index) => (
                                <div key={entry.name} className="flex items-center text-gray-500 dark:text-gray-400">
                                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></div>
                                    {entry.name}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Signups Table (From Backend) */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Signups</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                        <thead className="bg-gray-50 dark:bg-neutral-800 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {recentUsers.map((user, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                        {user.name} <br />
                                        <span className="text-xs text-gray-400 font-normal">{user.email}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{new Date(user.joined_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">{user.amount}</td>
                                </tr>
                            ))}
                            {recentUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No recent signups found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
