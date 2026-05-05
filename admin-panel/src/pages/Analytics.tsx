import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import httpClient from '../lib/httpClient';
import {
    AlertTriangle,
    Activity,
    TrendingUp,
    Sparkles,
    Users,
    Instagram,
    CheckCircle2,
    ChevronDown
} from 'lucide-react';
import {
    ResponsiveContainer,
    Tooltip,
    LineChart,
    Line,
    ReferenceLine,
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

const CHART_COLORS = ['#405DE6', '#833AB4', '#F56040', '#FCAF45', '#10B981', '#0EA5E9', '#FB7185'];
const TRAFFIC_WINDOWS = [
    { value: '24h', label: '24 hrs' },
    { value: '3d', label: '3 days' },
    { value: '7d', label: '7 days' },
    { value: '14d', label: '14 days' },
    { value: '21d', label: '21 days' },
    { value: '30d', label: '30 days' }
] as const;

const REVENUE_WINDOWS = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'custom', label: 'Custom' }
] as const;

const TRAFFIC_WINDOW_DETAILS: Record<(typeof TRAFFIC_WINDOWS)[number]['value'], string> = {
    '24h': 'Hourly view',
    '3d': 'Short trend',
    '7d': 'Weekly view',
    '14d': 'Biweekly view',
    '21d': 'Growth pulse',
    '30d': 'Monthly view'
};

const REVENUE_WINDOW_DETAILS: Record<(typeof REVENUE_WINDOWS)[number]['value'], string> = {
    '7d': 'Short revenue window',
    '30d': 'Monthly revenue view',
    '90d': 'Quarterly revenue view',
    custom: 'Choose a custom date range'
};

type PieDatum = { name: string; value: number };
type TrafficWindowValue = (typeof TRAFFIC_WINDOWS)[number]['value'];
type RevenueWindowValue = (typeof REVENUE_WINDOWS)[number]['value'];

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

const formatDateInputLocal = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const buildPresetDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(0, days - 1));
    return {
        start: formatDateInputLocal(start),
        end: formatDateInputLocal(end)
    };
};

const humanizeAnalyticsLabel = (value: string) => String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'N/A';

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

const GraphFilterDropdown = ({
    title,
    options,
    value,
    onChange,
    summary,
    detail,
    loadingText,
    allowCustom = false,
    customStart,
    customEnd,
    onCustomStartChange,
    onCustomEndChange,
    onApplyCustom
}: {
    title: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    value: string;
    onChange: (next: string) => void;
    summary: string;
    detail?: string;
    loadingText?: string | null;
    allowCustom?: boolean;
    customStart?: string;
    customEnd?: string;
    onCustomStartChange?: (next: string) => void;
    onCustomEndChange?: (next: string) => void;
    onApplyCustom?: () => void;
}) => {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const selected = options.find((option) => option.value === value) || options[0];

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    return (
        <div ref={dropdownRef} className="relative w-full min-w-0 sm:min-w-[198px] sm:max-w-[320px]">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-primary/30 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(99,102,241,0.16)_52%,rgba(15,23,42,0.06))] px-4 py-3 text-left shadow-[0_24px_44px_-30px_rgba(14,165,233,0.55)] backdrop-blur-xl transition-all hover:border-primary/45 hover:shadow-[0_26px_52px_-30px_rgba(99,102,241,0.45)]"
            >
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">{title}</p>
                    <p className="mt-1 truncate text-sm font-black text-foreground">{selected.label}</p>
                    <p className="mt-1 truncate text-[11px] font-semibold text-foreground">{summary}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium text-muted-foreground">{detail}</p>
                    {loadingText ? <p className="mt-1 text-[10px] font-semibold text-primary">{loadingText}</p> : null}
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+0.6rem)] z-30 w-full overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/95 p-2 shadow-[0_30px_70px_-34px_rgba(15,23,42,0.52)] backdrop-blur-xl">
                    <div className="max-h-[12.5rem] overflow-y-auto overscroll-contain">
                    {options.map((option) => {
                        const active = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    if (!allowCustom || option.value !== 'custom') {
                                        setOpen(false);
                                    }
                                }}
                                className={`flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground shadow-[0_18px_36px_-24px_rgba(14,165,233,0.85)]'
                                        : 'text-foreground hover:bg-background/80'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black">{option.label}</p>
                                    <p className={`mt-1 text-[11px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                        {title === 'Revenue Range'
                                            ? REVENUE_WINDOW_DETAILS[option.value as RevenueWindowValue]
                                            : TRAFFIC_WINDOW_DETAILS[option.value as TrafficWindowValue]}
                                    </p>
                                </div>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${active ? 'border-primary-foreground/30 text-primary-foreground/90' : 'border-border/70 text-muted-foreground'}`}>
                                    {option.value}
                                </span>
                            </button>
                        );
                    })}
                    </div>
                    {allowCustom && value === 'custom' && onApplyCustom && onCustomStartChange && onCustomEndChange ? (
                        <div className="mt-2 rounded-[1rem] border border-border/70 bg-background/70 p-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                    From
                                    <input
                                        type="date"
                                        value={customStart || ''}
                                        onChange={(event) => onCustomStartChange(event.target.value)}
                                        className="input-base mt-2"
                                    />
                                </label>
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                    To
                                    <input
                                        type="date"
                                        value={customEnd || ''}
                                        onChange={(event) => onCustomEndChange(event.target.value)}
                                        className="input-base mt-2"
                                    />
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onApplyCustom();
                                    setOpen(false);
                                }}
                                className="mt-3 btn-primary w-full px-4 py-3 text-[10px]"
                            >
                                Apply Custom Range
                            </button>
                        </div>
                    ) : null}
                </div>
            )}
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
        <p className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
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
                                        <p className="truncate text-sm font-bold text-foreground">{humanizeAnalyticsLabel(entry.name)}</p>
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
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [trafficWindow, setTrafficWindow] = useState<TrafficWindowValue>('30d');
    const [revenueWindow, setRevenueWindow] = useState<RevenueWindowValue>('30d');
    const [revenueCustomRange, setRevenueCustomRange] = useState(() => buildPresetDateRange(30));
    const hasLoadedOnceRef = useRef(false);
    const latestRequestRef = useRef(0);
    const deferredData = useDeferredValue(data);
    const displayData = deferredData ?? data;

    useEffect(() => {
        const load = async () => {
            const requestId = latestRequestRef.current + 1;
            latestRequestRef.current = requestId;
            try {
                if (!hasLoadedOnceRef.current) {
                    setLoading(true);
                } else {
                    setRefreshing(true);
                }
                setError(null);
                const response = await httpClient.get('/api/admin/analytics/overview', {
                    params: {
                        traffic_window: trafficWindow,
                        revenue_window: revenueWindow,
                        revenue_from: revenueWindow === 'custom' ? revenueCustomRange.start : undefined,
                        revenue_to: revenueWindow === 'custom' ? revenueCustomRange.end : undefined
                    }
                });
                if (latestRequestRef.current !== requestId) return;
                startTransition(() => {
                    setData(response.data);
                });
                hasLoadedOnceRef.current = true;
            } catch (err: any) {
                if (latestRequestRef.current !== requestId) return;
                setError(err?.response?.data?.error || 'Failed to load analytics.');
            } finally {
                if (latestRequestRef.current === requestId) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };

        load();
    }, [revenueCustomRange.end, revenueCustomRange.start, revenueWindow, trafficWindow]);

    const selectedTrafficWindow = TRAFFIC_WINDOWS.find((option) => option.value === trafficWindow)?.label || '30 days';
    const selectedRevenueWindow = REVENUE_WINDOWS.find((option) => option.value === revenueWindow)?.label || '30 days';
    const trafficFilterMeta = displayData?.filters?.traffic || {};
    const revenueFilterMeta = displayData?.filters?.revenue || {};
    const applyRevenueCustomRange = () => {
        if (!revenueCustomRange.start || !revenueCustomRange.end || revenueCustomRange.start > revenueCustomRange.end) {
            setError('Please choose a valid revenue range.');
            return;
        }
        setError(null);
        setRevenueWindow('custom');
    };
    const trafficChartData = useMemo(() => {
        const source = Array.isArray(displayData?.automation_traffic) ? displayData.automation_traffic : [];
        return source.map((entry: any) => ({
            ...entry,
            value: Number(entry?.value || 0)
        }));
    }, [displayData?.automation_traffic]);
    const trafficAverage = useMemo(() => {
        if (!trafficChartData.length) return 0;
        const total = trafficChartData.reduce((sum: number, row: { value: number }) => sum + Number(row.value || 0), 0);
        return total / trafficChartData.length;
    }, [trafficChartData]);
    const statusBreakdown = Array.isArray(displayData?.log_status_breakdown) ? displayData.log_status_breakdown : [];
    const statusTotal = statusBreakdown.reduce((sum: number, entry: PieDatum) => sum + Number(entry.value || 0), 0);
    const failedCount = statusBreakdown.find((entry: PieDatum) => String(entry.name).toLowerCase() === 'failed')?.value || 0;
    const successCount = statusBreakdown.find((entry: PieDatum) => String(entry.name).toLowerCase() === 'success')?.value || 0;
    const skippedCount = statusBreakdown.find((entry: PieDatum) => String(entry.name).toLowerCase() === 'skipped')?.value || 0;
    const deliverySuccessRate = statusTotal > 0 ? Math.round(((successCount + skippedCount) / statusTotal) * 100) : 100;
    const topAutomation = (Array.isArray(displayData?.automations_by_type) ? displayData.automations_by_type : [])[0];
    const topAutomationLabel = humanizeAnalyticsLabel(String(topAutomation?.name || 'N/A'));
    const noLinkedUsers = (Array.isArray(displayData?.linked_accounts_distribution) ? displayData.linked_accounts_distribution : [])
        .find((entry: PieDatum) => entry.name === '0 linked')?.value || 0;
    const latestRevenue = (() => {
        const revenue = Array.isArray(displayData?.monthly_revenue) ? displayData.monthly_revenue : [];
        return revenue.length > 0 ? Number(revenue[revenue.length - 1]?.value || 0) : 0;
    })();
    const revenueTotalForWindow = Number(displayData?.revenue_total_for_window || 0);
    const trafficSummaryLabel = selectedTrafficWindow;
    const revenueSummaryLabel = revenueWindow === 'custom'
        ? `${revenueFilterMeta.start_date || revenueCustomRange.start} to ${revenueFilterMeta.end_date || revenueCustomRange.end}`
        : selectedRevenueWindow;

    const metricCards = [
        { label: 'Revenue', value: moneyFormatter.format(revenueTotalForWindow), icon: TrendingUp, accent: 'bg-primary/12 text-primary' },
        { label: 'Users', value: numberFormatter.format(Number(displayData?.totals?.total_users || 0)), icon: Users, accent: 'bg-foreground/5 text-foreground' },
        { label: 'IG Accounts', value: numberFormatter.format(Number(displayData?.totals?.linked_instagram_accounts || 0)), icon: Instagram, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
        { label: 'Paid Users', value: numberFormatter.format(Number(displayData?.totals?.paid_users || 0)), icon: CheckCircle2, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
        { label: 'Automations', value: numberFormatter.format(Number(displayData?.totals?.active_automations || 0)), icon: Sparkles, accent: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400' },
        { label: 'Delivery', value: `${deliverySuccessRate}%`, icon: Activity, accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
    ];

    if (loading) {
        return <AdminLoadingState title="Loading analytics" description="Preparing revenue, delivery, and automation signals." />;
    }

    return (
        <div className="space-y-6 sm:space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className={`${surfaceClass} overflow-hidden p-6 sm:p-8 xl:p-9`}>
                <div className="space-y-6">
                    <div className="inline-flex rounded-full border border-primary/20 bg-gradient-to-r from-primary/12 to-transparent px-3 py-1 text-[10px] font-black text-primary">
                        Admin Analytics
                    </div>
                    <div className="max-w-3xl">
                        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Analytics overview</h1>
                        <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
                            Revenue, delivery, usage, and account coverage in one clean view.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <InsightTile label="Success" value={`${deliverySuccessRate}%`} note="Successful and skipped delivery share" />
                        <InsightTile label="Failed" value={numberFormatter.format(Number(failedCount || 0))} note="Events needing attention" />
                        <InsightTile label="Top Type" value={topAutomationLabel} note="Most active automation" />
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

            <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
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
                    value={Number(displayData?.pool?.usage_last_hour || 0)}
                    max={Number(displayData?.pool?.capacity_per_hour || 0)}
                    helper={`${numberFormatter.format(Number(displayData?.pool?.usage_last_hour || 0))}/${numberFormatter.format(Number(displayData?.pool?.capacity_per_hour || 0))} in use`}
                />
            </section>

            <section className="grid grid-cols-1 gap-7">
                <div className={`${surfaceClass} p-5 sm:p-7 xl:p-8 transition-opacity duration-300 ${refreshing ? 'opacity-85' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <h3 className="text-[1.55rem] font-extrabold tracking-tight text-foreground">Revenue trend</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">{revenueSummaryLabel}</p>
                        </div>
                        <div className="w-full lg:max-w-[320px] lg:shrink-0">
                            <GraphFilterDropdown
                                title="Revenue Range"
                                options={REVENUE_WINDOWS}
                                value={revenueWindow}
                                onChange={(next) => setRevenueWindow(next as RevenueWindowValue)}
                                summary={revenueSummaryLabel}
                                detail={`Revenue total ${moneyFormatter.format(revenueTotalForWindow)}`}
                                loadingText={refreshing ? 'Refreshing revenue analytics...' : null}
                                allowCustom
                                customStart={revenueCustomRange.start}
                                customEnd={revenueCustomRange.end}
                                onCustomStartChange={(next) => setRevenueCustomRange((prev) => ({ ...prev, start: next }))}
                                onCustomEndChange={(next) => setRevenueCustomRange((prev) => ({ ...prev, end: next }))}
                                onApplyCustom={applyRevenueCustomRange}
                            />
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
                        <div className="order-2 h-[260px] sm:h-[320px] xl:order-1 xl:h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Array.isArray(displayData?.monthly_revenue) ? displayData.monthly_revenue : []}>
                                    <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<ChartTooltip label="Revenue" formatter={(value) => moneyFormatter.format(value)} />} />
                                    <Bar dataKey="value" fill="#833AB4" radius={[10, 10, 0, 0]} maxBarSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="order-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:order-2 xl:grid-cols-1">
                            <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-5">
                                <p className="text-[10px] font-black text-muted-foreground">Revenue Total</p>
                                <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{moneyFormatter.format(revenueTotalForWindow)}</p>
                                <p className="mt-2 text-sm text-muted-foreground">Total within the selected revenue range.</p>
                            </div>
                            <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-5">
                                <p className="text-[10px] font-black text-muted-foreground">Latest Revenue</p>
                                <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{moneyFormatter.format(latestRevenue)}</p>
                                <p className="mt-2 text-sm text-muted-foreground">Most recent plotted day in the active revenue window.</p>
                            </div>
                            <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-5">
                                <p className="text-[10px] font-black text-muted-foreground">No IG Link</p>
                                <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{numberFormatter.format(Number(noLinkedUsers || 0))}</p>
                                <p className="mt-2 text-sm text-muted-foreground">Users still waiting for an Instagram account connection.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${surfaceClass} p-5 sm:p-7 xl:p-8 transition-opacity duration-300 ${refreshing ? 'opacity-85' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <h3 className="text-[1.55rem] font-extrabold tracking-tight text-foreground">Automation traffic</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">Last 30 days of stored delivery activity, shown across flexible traffic windows.</p>
                        </div>
                        <div className="w-full lg:max-w-[320px] lg:shrink-0">
                            <GraphFilterDropdown
                                title="Automation Range"
                                options={TRAFFIC_WINDOWS}
                                value={trafficWindow}
                                onChange={(next) => setTrafficWindow(next as TrafficWindowValue)}
                                summary={trafficSummaryLabel}
                                detail={`Average ${trafficAverage.toFixed(1)} actions per ${trafficFilterMeta.bucket === 'hour' ? 'hour' : 'point'}`}
                                loadingText={refreshing ? 'Refreshing automation analytics...' : null}
                            />
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
                        <div className="order-2 h-[260px] sm:h-[320px] xl:order-1 xl:h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trafficChartData}>
                                    <defs>
                                        <linearGradient id="adminTrafficGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                                            <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                                        </linearGradient>
                                        <filter id="adminTrafficGlow" x="-50%" y="-50%" width="200%" height="200%">
                                            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                                            <feMerge>
                                                <feMergeNode in="coloredBlur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<ChartTooltip label="Traffic" formatter={(value) => `${numberFormatter.format(value)} events`} />} />
                                    <ReferenceLine
                                        y={trafficAverage}
                                        stroke="rgba(148,163,184,0.95)"
                                        strokeDasharray="6 6"
                                        ifOverflow="extendDomain"
                                        label={{
                                            value: `Avg ${trafficAverage.toFixed(1)}`,
                                            position: 'insideTopRight',
                                            fill: '#94a3b8',
                                            fontSize: 10
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="url(#adminTrafficGradient)"
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 5 }}
                                        filter="url(#adminTrafficGlow)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="order-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:order-2 xl:grid-cols-1">
                            <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-5">
                                <p className="text-[10px] font-black text-muted-foreground">Active Automation Range</p>
                                <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">{trafficSummaryLabel}</p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Average {trafficAverage.toFixed(1)} actions per {trafficFilterMeta.bucket === 'hour' ? 'hour' : 'point'}.
                                </p>
                            </div>
                            <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-5">
                                <p className="text-[10px] font-black text-muted-foreground">Signals</p>
                                <div className="mt-4 space-y-4">
                                    <InsightTile label="Success Rate" value={`${deliverySuccessRate}%`} note="Success plus skipped events" />
                                    <InsightTile label="Recent Revenue" value={moneyFormatter.format(latestRevenue)} note="Most recent day in trend" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-7 2xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-7">
                    <PieSummaryCard
                        title="Automation Mix"
                        subtitle="By type"
                        data={Array.isArray(displayData?.automations_by_type) ? displayData.automations_by_type : []}
                    />
                    <PieSummaryCard
                        title="Linked Account Spread"
                        subtitle="Per user"
                        data={Array.isArray(displayData?.linked_accounts_distribution) ? displayData.linked_accounts_distribution : []}
                    />
                </div>
                <div className={`${surfaceClass} p-6 sm:p-7 transition-opacity duration-300 ${refreshing ? 'opacity-85' : 'opacity-100'}`}>
                    <div className="mb-5">
                        <h3 className="text-[1.45rem] font-extrabold tracking-tight text-foreground">Recent failures</h3>
                        <p className="mt-1 text-[11px] font-black text-muted-foreground">Latest events in the active automation range</p>
                    </div>
                    <div className="space-y-3">
                        {(Array.isArray(displayData?.recent_failures) ? displayData.recent_failures : []).length === 0 ? (
                            <div className="rounded-[24px] border border-success/30 bg-success-muted/60 px-5 py-9 text-center text-sm font-medium text-success">
                                No recent failures.
                            </div>
                        ) : (displayData?.recent_failures as Array<any>).map((item) => (
                            <div key={item.id} className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <p className="text-sm font-bold text-foreground">{humanizeAnalyticsLabel(item.event_type)}</p>
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
            </section>

            <section className="space-y-7">
                <PieSummaryCard
                    title="Delivery Outcomes"
                    subtitle={trafficSummaryLabel}
                    data={statusBreakdown}
                />
            </section>
        </div>
    );
};

export default AnalyticsPage;
