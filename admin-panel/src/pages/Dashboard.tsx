import React, { useEffect, useMemo, useState } from 'react';
import httpClient from '../lib/httpClient';
import {
    Users,
    Instagram,
    Activity,
    TrendingUp,
    AlertTriangle,
    Sparkles,
    ArrowUpRight,
    CreditCard,
    Wallet,
    BarChart3,
    TicketPercent
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    CartesianGrid
} from 'recharts';
import { cn } from '../lib/utils';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminGauge from '../components/ui/AdminGauge';

const COLORS = ['#405DE6', '#833AB4', '#F56040', '#FCAF45', '#10B981', '#0EA5E9'];

const numberFormatter = new Intl.NumberFormat('en-IN');
const moneyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
});

const surfaceClass = 'glass-card rounded-[30px] border border-border/70 bg-card/95';
const chartGridStroke = 'rgb(148 163 184 / 0.18)';

const ChartTooltip = ({
    active,
    payload,
    label,
    valueFormatter
}: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string }>;
    label?: string;
    valueFormatter?: (value: number) => string;
}) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
            {label && <p className="text-[10px] font-black text-muted-foreground">{label}</p>}
            <div className="mt-2 space-y-2">
                {payload.map((entry, index) => (
                    <div key={`${entry.name || 'value'}-${index}`} className="flex items-center justify-between gap-4 text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
                            />
                            <span className="font-semibold">{entry.name || 'Value'}</span>
                        </span>
                        <span className="font-black text-foreground">
                            {valueFormatter ? valueFormatter(Number(entry.value || 0)) : numberFormatter.format(Number(entry.value || 0))}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<any>(null);
    const [recentUsers, setRecentUsers] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [metricsRes, usersRes] = await Promise.all([
                    httpClient.get('/api/admin/dashboard/metrics'),
                    httpClient.get('/api/admin/users', { params: { page: 1, page_size: 6 } })
                ]);
                setMetrics(metricsRes.data);
                setRecentUsers(usersRes.data?.users || []);
            } catch (error) {
                console.error('Failed to load metrics:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const growthData = useMemo(() => {
        const raw = metrics?.user_growth || {};
        return Object.keys(raw)
            .sort()
            .map((day) => ({ day: day.slice(5).replace('-', '/'), users: Number(raw[day] || 0) }));
    }, [metrics]);

    const planDistribution = useMemo(() => {
        const plans = metrics?.plans || {};
        return Object.entries(plans)
            .map(([name, value]) => ({ name, value: Number(value || 0) }))
            .filter((entry) => entry.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [metrics]);

    const totalPlanUsers = useMemo(
        () => planDistribution.reduce((sum, entry) => sum + entry.value, 0),
        [planDistribution]
    );

    const topPlan = planDistribution[0];
    const poolUsagePercent = Number(metrics?.pool?.usage_percent || 0);
    const revenueLast30Days = Number(metrics?.revenue_last_30_days || 0);
    const revenueLast7Days = Number(metrics?.revenue_last_7_days || 0);
    const paidUsersCount = Number(metrics?.totals?.paid_users || 0);
    const totalUsersCount = Number(metrics?.totals?.total_users || 0);
    const averageDailyRevenue = revenueLast30Days > 0 ? revenueLast30Days / 30 : 0;
    const revenuePerPaidUser = paidUsersCount > 0 ? revenueLast30Days / paidUsersCount : 0;
    const paidConversionRate = totalUsersCount > 0 ? Math.round((paidUsersCount / totalUsersCount) * 100) : 0;
    const totalMonthlyBudget = Number(metrics?.totals?.total_users || 0) > 0
        ? Number(metrics?.totals?.total_users || 0) * 100
        : 0;
    const consumedBudget = Number(metrics?.pool?.usage_last_hour || 0);
    const revenueTrend = Array.isArray(metrics?.revenue_series_30_days)
        ? metrics.revenue_series_30_days.map((entry: any) => ({
            day: String(entry.day || '').slice(5).replace('-', '/'),
            value: Number(entry.value || 0)
        }))
        : [];

    const overviewCards = [
        { label: 'Total Users', value: numberFormatter.format(Number(metrics?.totals?.total_users || 0)), icon: Users, tone: 'text-primary bg-primary/10' },
        { label: 'Linked IG Accounts', value: numberFormatter.format(Number(metrics?.totals?.linked_instagram_accounts || 0)), icon: Instagram, tone: 'text-ig-orange bg-warning/15' },
        { label: 'Paid Users', value: numberFormatter.format(Number(metrics?.totals?.paid_users || 0)), icon: CreditCard, tone: 'text-success bg-success/15' },
        { label: 'Success Rate', value: `${Number(metrics?.totals?.overall_success_rate || 0)}%`, icon: Activity, tone: 'text-ig-blue bg-ig-blue/10' },
        { label: 'Active Automations', value: numberFormatter.format(Number(metrics?.totals?.active_automations || 0)), icon: Sparkles, tone: 'text-warning bg-warning/15' },
        { label: 'Revenue 30 Days', value: moneyFormatter.format(Number(metrics?.revenue_last_30_days || 0)), icon: TrendingUp, tone: 'text-primary bg-primary/10' },
        { label: 'Coupon Redemptions', value: numberFormatter.format(Number(metrics?.coupons?.total_redemptions || 0)), icon: TicketPercent, tone: 'text-success bg-success/15' }
    ];

    if (loading) {
        return <AdminLoadingState title="Loading admin metrics" description="Preparing live subscription, growth, and automation health data." />;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className={`${surfaceClass} overflow-hidden p-6 sm:p-8`}>
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="text-[10px] font-black text-primary/75">Overview</p>
                            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Platform Control</h1>
                            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
                                Track growth, subscriptions, and automation health from one clean view.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <div className="status-pill status-pill-success">
                                    <span className="h-2 w-2 rounded-full bg-success" />
                                    Live data
                                </div>
                                <div className="status-pill border border-border bg-card text-foreground">
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                    {topPlan ? `${topPlan.name} leads plan mix` : 'Plan mix ready'}
                                </div>
                            </div>
                        </div>

                        <div className="w-full xl:w-96 shrink-0">
                            <div className="rounded-[26px] border border-border/70 bg-background/70 p-5">
                                <p className="text-[10px] font-black text-muted-foreground">Plan Leader</p>
                                <p className="mt-3 text-2xl font-extrabold text-foreground">{topPlan?.name || 'No plan data'}</p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {topPlan
                                        ? `${numberFormatter.format(topPlan.value)} users are on the leading plan.`
                                        : 'Plan distribution appears here after data is loaded.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <AdminGauge
                            label="Actions Per Hour"
                            sublabel="Live pool draw vs capacity"
                            value={Number(metrics?.pool?.usage_last_hour || 0)}
                            max={Number(metrics?.pool?.capacity_per_hour || 0)}
                            helper={`${poolUsagePercent}% of the current hourly action pool is already allocated.`}
                        />
                        <AdminGauge
                            label="Consumed Amount"
                            sublabel="Usage vs working budget"
                            value={consumedBudget}
                            max={Math.max(totalMonthlyBudget, consumedBudget, 1)}
                            helper="Computation-backed real current usage tracking."
                        />
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                {overviewCards.map((card) => (
                    <div key={card.label} className={`${surfaceClass} px-5 py-5`}>
                        <div className="flex items-start justify-between gap-4">
                            <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', card.tone)}>
                                <card.icon className="h-5 w-5" />
                            </div>
                            <p className="text-right text-[10px] font-black text-muted-foreground">{card.label}</p>
                        </div>
                        <p className="mt-5 text-3xl font-extrabold tracking-tight text-foreground">{card.value}</p>
                    </div>
                ))}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
                <div className={`${surfaceClass} p-6 sm:p-7`}>
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">Revenue Pulse</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Last 30 days</p>
                        </div>
                        <div className="status-pill border border-border bg-background/70 text-foreground">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                            Cashflow trend
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">30 day revenue</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{moneyFormatter.format(revenueLast30Days)}</p>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">7 day revenue</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{moneyFormatter.format(revenueLast7Days)}</p>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Avg / day</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{moneyFormatter.format(averageDailyRevenue)}</p>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Revenue / paid user</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{moneyFormatter.format(revenuePerPaidUser)}</p>
                        </div>
                    </div>

                    <div className="mt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueTrend}>
                                <defs>
                                    <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#833AB4" stopOpacity={0.32} />
                                        <stop offset="100%" stopColor="#833AB4" stopOpacity={0.03} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<ChartTooltip label="Revenue" valueFormatter={(value) => moneyFormatter.format(value)} />} />
                                <Area type="monotone" dataKey="value" stroke="#833AB4" fill="url(#dashboardRevenueFill)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={`${surfaceClass} p-6 sm:p-7`}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">Revenue Notes</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Quick read</p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Paid conversion</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{paidConversionRate}%</p>
                            <p className="mt-1 text-sm text-muted-foreground">Share of users on paid plans.</p>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Leading plan</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{topPlan?.name || 'No plan data'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {topPlan
                                    ? `${numberFormatter.format(topPlan.value)} users are on the most common plan.`
                                    : 'Plan distribution appears here after data is loaded.'}
                            </p>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Revenue signal</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">{revenueLast7Days >= averageDailyRevenue * 7 ? 'Ahead' : 'Steady'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {revenueLast7Days >= averageDailyRevenue * 7
                                    ? 'The last 7 days are pacing above the rolling daily average.'
                                    : 'The last 7 days are close to the rolling daily average.'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
                <div className={`${surfaceClass} p-6 sm:p-7`}>
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">User Growth</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Last 7 days</p>
                        </div>
                        <div className="status-pill border border-border bg-background/70 text-foreground">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            Signup trend
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={growthData}>
                                <defs>
                                    <linearGradient id="dashboardGrowthFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#405DE6" stopOpacity={0.28} />
                                        <stop offset="100%" stopColor="#405DE6" stopOpacity={0.03} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<ChartTooltip label="Daily Signups" valueFormatter={(value) => `${numberFormatter.format(value)} users`} />} />
                                <Area type="monotone" dataKey="users" stroke="#405DE6" fill="url(#dashboardGrowthFill)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={`${surfaceClass} p-6 sm:p-7`}>
                    <div className="mb-5">
                        <h2 className="text-xl font-extrabold text-foreground">Plan Distribution</h2>
                        <p className="mt-1 text-xs font-black text-muted-foreground">All user profiles</p>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-1">
                        <div className="mx-auto flex h-[220px] w-full max-w-[260px] items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={planDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={56}
                                        outerRadius={90}
                                        paddingAngle={4}
                                        stroke="none"
                                    >
                                        {planDistribution.map((entry, index) => (
                                            <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip label="Plan Mix" valueFormatter={(value) => `${numberFormatter.format(value)} users`} />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-4 py-4 text-center">
                            <p className="text-[10px] font-black text-muted-foreground">Tracked Profiles</p>
                            <p className="mt-2 text-3xl font-extrabold text-foreground">{numberFormatter.format(totalPlanUsers)}</p>
                        </div>
                        <div className="space-y-3">
                            {planDistribution.length === 0 ? (
                                <div className="rounded-[22px] border border-dashed border-border bg-background/60 px-4 py-6 text-center text-sm font-medium text-muted-foreground">
                                    No plan distribution data is available yet.
                                </div>
                            ) : planDistribution.map((entry, index) => {
                                const share = totalPlanUsers > 0 ? Math.round((entry.value / totalPlanUsers) * 100) : 0;
                                return (
                                    <div key={entry.name} className="rounded-[22px] border border-border/70 bg-background/60 px-4 py-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                <span className="truncate text-sm font-bold text-foreground">{entry.name}</span>
                                            </div>
                                            <span className="text-sm font-black text-foreground">{share}%</span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${share}%`, backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <div className={`${surfaceClass} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-border/70 px-6 py-5 sm:px-7">
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">Recent Users</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Latest signups</p>
                        </div>
                        <div className="status-pill border border-border bg-background/70 text-foreground">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            {recentUsers.length} shown
                        </div>
                    </div>
                    <div className="divide-y divide-border/70">
                        {recentUsers.length === 0 ? (
                            <div className="px-6 py-12 text-center text-sm text-muted-foreground">No recent users available.</div>
                        ) : recentUsers.map((user) => (
                            <div key={user.$id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{user.name || 'Unnamed User'}</p>
                                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                    {new Date(user.$createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`${surfaceClass} p-6 sm:p-7`}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">Operational Notes</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Quick review</p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Linked Account Coverage</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">
                                {numberFormatter.format(Number(metrics?.totals?.linked_instagram_accounts || 0))}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">Instagram accounts connected across the workspace.</p>
                        </div>
                        <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                            <p className="text-[10px] font-black text-muted-foreground">Conversion Snapshot</p>
                            <p className="mt-2 text-2xl font-extrabold text-foreground">
                                {numberFormatter.format(Number(metrics?.totals?.paid_users || 0))}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">Paid users active right now.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
