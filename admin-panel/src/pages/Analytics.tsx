import React, { useEffect, useState } from 'react';
import httpClient from '../lib/httpClient';
import {
    AlertTriangle,
    Activity,
    TrendingUp,
    Sparkles,
    Users,
    Instagram,
    CheckCircle2
} from 'lucide-react';
import {
    ResponsiveContainer,
    Tooltip,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminGauge from '../components/ui/AdminGauge';
import SelectField from '../components/ui/SelectField';

const CHART_COLORS = ['#405DE6', '#833AB4', '#F56040', '#FCAF45', '#10B981', '#0EA5E9', '#FB7185'];
const TRAFFIC_WINDOWS = [
    { value: '24h', label: '24 hrs' },
    { value: '7d', label: '7 days' },
    { value: '14d', label: '14 days' },
    { value: '21d', label: '21 days' },
    { value: '30d', label: '30 days' }
] as const;

type PieDatum = { name: string; value: number };

const moneyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('en-IN');

const surfaceClass = 'glass-card rounded-[32px] border border-border/70 bg-card/95 shadow-[0_22px_65px_rgba(15,23,42,0.07)]';
const chartGridStroke = 'rgb(148 163 184 / 0.18)';

const formatShortDate = (value: string | number | Date | null | undefined) => {
    if (!value) return 'Unknown';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${day}-${month}-${year}`;
};

const ChartTooltip = ({
    active,
    payload,
    label,
    formatter
}: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string }>;
    label?: string;
    formatter?: (value: number) => string;
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
                                style={{ backgroundColor: entry.color || CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="font-semibold">{entry.name || 'Value'}</span>
                        </span>
                        <span className="font-black text-foreground">
                            {formatter ? formatter(Number(entry.value || 0)) : numberFormatter.format(Number(entry.value || 0))}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MetricCard = ({
    icon: Icon,
    label,
    value,
    accent
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    accent: string;
}) => (
    <div className={`${surfaceClass} p-6`}>
        <div className="flex items-start justify-between gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-right text-[10px] font-black text-muted-foreground">{label}</p>
        </div>
        <p className="mt-7 text-[2rem] font-extrabold tracking-tight text-foreground">{value}</p>
    </div>
);

const InsightTile = ({ label, value, note }: { label: string; value: string; note: string }) => (
    <div className="rounded-[26px] border border-border/70 bg-background/60 px-5 py-5">
        <p className="text-[10px] font-black text-muted-foreground">{label}</p>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
);

const PieSummaryCard = ({
    title,
    subtitle,
    data,
    formatter
}: {
    title: string;
    subtitle: string;
    data: PieDatum[];
    formatter?: (value: number) => string;
}) => {
    const safeData = Array.isArray(data) ? data.filter((entry) => Number(entry?.value || 0) > 0) : [];
    const totalValue = safeData.reduce((sum, entry) => sum + Number(entry.value || 0), 0);

    return (
        <div className={`${surfaceClass} p-7 sm:p-8`}>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h3 className="text-[1.55rem] font-extrabold tracking-tight text-foreground">{title}</h3>
                    <p className="mt-1 text-[11px] font-black text-muted-foreground">{subtitle}</p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[10px] font-black text-muted-foreground">
                    Total {formatter ? formatter(totalValue) : numberFormatter.format(totalValue)}
                </span>
            </div>

            <div className="grid gap-7 xl:grid-cols-[250px_minmax(0,1fr)] xl:items-center">
                <div className="mx-auto flex h-[240px] w-full max-w-[240px] items-center justify-center rounded-[34px] bg-gradient-to-br from-primary/10 via-background to-background p-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={safeData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={58}
                                outerRadius={98}
                                paddingAngle={3}
                                stroke="none"
                            >
                                {safeData.map((entry, index) => (
                                    <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip label={title} formatter={formatter} />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                    {safeData.length === 0 ? (
                        <div className="rounded-[26px] border border-dashed border-border bg-background/60 px-5 py-9 text-center text-sm font-medium text-muted-foreground">
                            No data yet.
                        </div>
                    ) : safeData.map((entry, index) => {
                        const value = Number(entry.value || 0);
                        const share = totalValue > 0 ? Math.round((value / totalValue) * 100) : 0;
                        return (
                            <div key={entry.name} className="rounded-[24px] border border-border/70 bg-background/60 px-4 py-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                        <p className="truncate text-sm font-bold text-foreground">{entry.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-foreground">
                                            {formatter ? formatter(value) : numberFormatter.format(value)}
                                        </p>
                                        <p className="text-[11px] font-semibold text-muted-foreground">{share}%</p>
                                    </div>
                                </div>
                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.max(share, 6)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const AnalyticsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [trafficWindow, setTrafficWindow] = useState<(typeof TRAFFIC_WINDOWS)[number]['value']>('30d');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await httpClient.get('/api/admin/analytics/overview', {
                    params: { window: trafficWindow }
                });
                setData(response.data);
            } catch (err: any) {
                setError(err?.response?.data?.error || 'Failed to load analytics.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [trafficWindow]);

    const selectedTrafficWindow = TRAFFIC_WINDOWS.find((option) => option.value === trafficWindow)?.label || '30 days';
    const statusBreakdown = Array.isArray(data?.log_status_breakdown) ? data.log_status_breakdown : [];
    const statusTotal = statusBreakdown.reduce((sum: number, entry: PieDatum) => sum + Number(entry.value || 0), 0);
    const failedCount = statusBreakdown.find((entry: PieDatum) => String(entry.name).toLowerCase() === 'failed')?.value || 0;
    const successCount = statusBreakdown.find((entry: PieDatum) => String(entry.name).toLowerCase() === 'success')?.value || 0;
    const skippedCount = statusBreakdown.find((entry: PieDatum) => String(entry.name).toLowerCase() === 'skipped')?.value || 0;
    const deliverySuccessRate = statusTotal > 0 ? Math.round(((successCount + skippedCount) / statusTotal) * 100) : 100;
    const topAutomation = (Array.isArray(data?.automations_by_type) ? data.automations_by_type : [])[0];
    const noLinkedUsers = (Array.isArray(data?.linked_accounts_distribution) ? data.linked_accounts_distribution : [])
        .find((entry: PieDatum) => entry.name === '0 linked')?.value || 0;
    const latestRevenue = (() => {
        const revenue = Array.isArray(data?.monthly_revenue) ? data.monthly_revenue : [];
        return revenue.length > 0 ? Number(revenue[revenue.length - 1]?.value || 0) : 0;
    })();

    const metricCards = [
        { label: 'Revenue', value: moneyFormatter.format(Number(data?.revenue_last_30_days || 0)), icon: TrendingUp, accent: 'bg-primary/12 text-primary' },
        { label: 'Users', value: numberFormatter.format(Number(data?.totals?.total_users || 0)), icon: Users, accent: 'bg-foreground/5 text-foreground' },
        { label: 'IG Accounts', value: numberFormatter.format(Number(data?.totals?.linked_instagram_accounts || 0)), icon: Instagram, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
        { label: 'Paid Users', value: numberFormatter.format(Number(data?.totals?.paid_users || 0)), icon: CheckCircle2, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
        { label: 'Automations', value: numberFormatter.format(Number(data?.totals?.active_automations || 0)), icon: Sparkles, accent: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400' },
        { label: 'Delivery', value: `${deliverySuccessRate}%`, icon: Activity, accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
    ];

    if (loading) {
        return <AdminLoadingState title="Loading analytics" description="Preparing revenue, delivery, and automation signals." />;
    }

    return (
        <div className="space-y-9 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className={`${surfaceClass} overflow-hidden p-7 sm:p-9`}>
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_380px] xl:items-start">
                    <div className="space-y-5">
                        <div className="inline-flex rounded-full border border-primary/20 bg-gradient-to-r from-primary/12 to-transparent px-3 py-1 text-[10px] font-black text-primary">
                            Admin Analytics
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Analytics overview</h1>
                            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                                Revenue, delivery, usage, and account coverage in one clean view.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <InsightTile label="Success" value={`${deliverySuccessRate}%`} note="Successful and skipped delivery share" />
                            <InsightTile label="Failed" value={numberFormatter.format(Number(failedCount || 0))} note="Events needing attention" />
                            <InsightTile label="Top Type" value={topAutomation?.name || 'N/A'} note="Most active automation" />
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-border/70 bg-background/70 p-5">
                        <p className="text-[10px] font-black text-muted-foreground">Window</p>
                        <div className="mt-4 space-y-4">
                            <div className="rounded-[22px] border border-primary/20 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent px-4 py-4">
                                <p className="text-[10px] font-black text-muted-foreground">Active range</p>
                                <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{selectedTrafficWindow}</p>
                            </div>
                            <SelectField
                                label=""
                                value={trafficWindow}
                                onChange={(value) => setTrafficWindow(value as any)}
                            >
                                {TRAFFIC_WINDOWS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </SelectField>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[22px] border border-border/60 bg-card/80 px-4 py-4">
                                    <p className="text-[10px] font-black text-muted-foreground">No IG Link</p>
                                    <p className="mt-2 text-2xl font-extrabold text-foreground">{numberFormatter.format(Number(noLinkedUsers || 0))}</p>
                                </div>
                                <div className="rounded-[22px] border border-border/60 bg-card/80 px-4 py-4">
                                    <p className="text-[10px] font-black text-muted-foreground">Latest Revenue</p>
                                    <p className="mt-2 text-2xl font-extrabold text-foreground">{moneyFormatter.format(latestRevenue)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-[24px] border border-warning/30 bg-warning-muted/60 px-5 py-4 text-sm text-warning-foreground dark:text-warning">
                    <div className="inline-flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4" /> {error}
                    </div>
                </div>
            )}

            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {metricCards.map((item) => (
                    <MetricCard
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        value={item.value}
                        accent={item.accent}
                    />
                ))}
            </section>

            <section className="grid grid-cols-1 gap-5">
                <AdminGauge
                    label="Actions Per Hour"
                    sublabel="Current usage against the pool capacity"
                    value={Number(data?.pool?.usage_last_hour || 0)}
                    max={Number(data?.pool?.capacity_per_hour || 0)}
                    helper={`${numberFormatter.format(Number(data?.pool?.usage_last_hour || 0))}/${numberFormatter.format(Number(data?.pool?.capacity_per_hour || 0))} in use`}
                />
            </section>

            <section className="grid grid-cols-1 gap-7 2xl:grid-cols-[minmax(0,1.2fr)_380px]">
                <div className="space-y-7">
                    <div className={`${surfaceClass} p-7 sm:p-8`}>
                        <div className="mb-6">
                            <h3 className="text-[1.55rem] font-extrabold tracking-tight text-foreground">Automation traffic</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">{selectedTrafficWindow}</p>
                        </div>
                        <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={Array.isArray(data?.automation_traffic) ? data.automation_traffic : []}>
                                    <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<ChartTooltip label="Traffic" formatter={(value) => `${numberFormatter.format(value)} events`} />} />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#405DE6"
                                        strokeWidth={3}
                                        dot={{ r: 3, fill: '#405DE6' }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className={`${surfaceClass} p-7 sm:p-8`}>
                        <div className="mb-6">
                            <h3 className="text-[1.55rem] font-extrabold tracking-tight text-foreground">Revenue trend</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">Last 30 days</p>
                        </div>
                        <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Array.isArray(data?.monthly_revenue) ? data.monthly_revenue : []}>
                                    <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<ChartTooltip label="Revenue" formatter={(value) => moneyFormatter.format(value)} />} />
                                    <Bar dataKey="value" fill="#833AB4" radius={[10, 10, 0, 0]} maxBarSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="space-y-7">
                    <div className={`${surfaceClass} p-7`}>
                        <div className="mb-5">
                            <h3 className="text-[1.45rem] font-extrabold tracking-tight text-foreground">Signals</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">Quick read</p>
                        </div>
                        <div className="space-y-4">
                            <InsightTile label="Success Rate" value={`${deliverySuccessRate}%`} note="Success plus skipped events" />
                            <InsightTile label="No IG Link" value={numberFormatter.format(Number(noLinkedUsers || 0))} note="Users still unlinked" />
                            <InsightTile label="Recent Revenue" value={moneyFormatter.format(latestRevenue)} note="Most recent day in trend" />
                        </div>
                    </div>

                    <div className={`${surfaceClass} p-7`}>
                        <div className="mb-5">
                            <h3 className="text-[1.45rem] font-extrabold tracking-tight text-foreground">Recent failures</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">Latest events</p>
                        </div>
                        <div className="space-y-3">
                            {(Array.isArray(data?.recent_failures) ? data.recent_failures : []).length === 0 ? (
                                <div className="rounded-[24px] border border-success/30 bg-success-muted/60 px-5 py-9 text-center text-sm font-medium text-success">
                                    No recent failures.
                                </div>
                            ) : (data.recent_failures as Array<any>).map((item) => (
                                <div key={item.id} className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <p className="text-sm font-bold text-foreground">{item.event_type}</p>
                                            <span className="shrink-0 text-[10px] font-black text-muted-foreground">
                                                {formatShortDate(item.sent_at || 0)}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-6 text-muted-foreground">{item.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-7">
                <PieSummaryCard
                    title="Automation Mix"
                    subtitle="By type"
                    data={Array.isArray(data?.automations_by_type) ? data.automations_by_type : []}
                />
                <PieSummaryCard
                    title="Linked Account Spread"
                    subtitle="Per user"
                    data={Array.isArray(data?.linked_accounts_distribution) ? data.linked_accounts_distribution : []}
                />
                <PieSummaryCard
                    title="Delivery Outcomes"
                    subtitle={selectedTrafficWindow}
                    data={statusBreakdown}
                />
            </section>
        </div>
    );
};

export default AnalyticsPage;
