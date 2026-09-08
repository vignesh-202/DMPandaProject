import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Layers3, Sparkles, TrendingUp } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const numberFormatter = new Intl.NumberFormat('en-IN');
const surfaceClass = 'rounded-2xl border border-border bg-card shadow-xs';

const AutomationTooltip = ({
    active,
    payload,
    label
}: {
    active?: boolean;
    payload?: Array<{ value?: number }>;
    label?: string;
}) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-border bg-card/95 px-3.5 py-2.5 shadow-md backdrop-blur-xl">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1 text-xs font-bold text-foreground">{numberFormatter.format(Number(payload[0]?.value || 0))} automations</p>
        </div>
    );
};

export const AutomationsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const response = await httpClient.get('/api/admin/automations');
                setData(response.data);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const summaryCards = useMemo(() => ([
        {
            label: 'Total',
            value: numberFormatter.format(Number(data?.summary?.total || 0)),
            icon: Layers3,
            tone: 'text-primary bg-primary/10'
        },
        {
            label: 'Active',
            value: numberFormatter.format(Number(data?.summary?.active || 0)),
            icon: Sparkles,
            tone: 'text-emerald-600 bg-emerald-500/10'
        },
        {
            label: 'Templates',
            value: numberFormatter.format(Number(data?.summary?.with_templates || 0)),
            icon: Activity,
            tone: 'text-amber-600 bg-amber-500/10'
        }
    ]), [data]);

    if (loading) {
        return <AdminLoadingState title="Loading automations" description="Collecting automation totals, types, and the latest rule changes." />;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className={`${surfaceClass} overflow-hidden p-5 sm:p-7`}>
                <div className="grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,320px)] xl:items-start">
                    <div>
                        <p className="text-xs font-semibold text-primary">Automation</p>
                        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Automation Control</h1>
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                            Review automation volume, active coverage, and the latest rule updates in one clear workspace.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:gap-4 xl:grid-cols-1">
                        {summaryCards.map((card) => (
                            <div key={card.label} className="rounded-xl border border-border bg-background/70 p-3 sm:p-4 shadow-xs">
                                <div className="flex items-start justify-between gap-2 sm:gap-4">
                                    <div className={cn('flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg', card.tone)}>
                                        <card.icon className="h-4 w-4" />
                                    </div>
                                    <p className="text-right text-xs font-medium text-muted-foreground">{card.label}</p>
                                </div>
                                <p className="mt-2 sm:mt-3 text-lg sm:text-2xl font-bold tracking-tight text-foreground">{card.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.78fr,1.22fr]">
                <div className={`${surfaceClass} p-4 sm:p-6 lg:p-7`}>
                    <div className="mb-4 sm:mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Type Mix</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Current count</p>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-foreground">
                            <Layers3 className="h-3.5 w-3.5 text-primary" />
                            Live summary
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        {(Array.isArray(data?.by_type) ? data.by_type : []).length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-muted-foreground">
                                No automation types available yet.
                            </div>
                        ) : (
                            (Array.isArray(data?.by_type) ? data.by_type : []).map((item: any, index: number) => (
                                <div key={item.name} className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3 shadow-xs">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <span className={cn(
                                                'h-2 w-2 rounded-full',
                                                index % 3 === 0 ? 'bg-primary' : index % 3 === 1 ? 'bg-emerald-500' : 'bg-amber-500'
                                            )} />
                                            <span className="truncate text-xs font-semibold text-foreground">{item.name}</span>
                                        </div>
                                        <span className="text-xs font-bold text-foreground">{numberFormatter.format(Number(item.value || 0))}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={`${surfaceClass} overflow-hidden`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5 lg:px-7">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Recent Updates</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Latest changes</p>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-foreground">
                            <Clock3 className="h-3.5 w-3.5 text-primary" />
                            Most recent first
                        </div>
                    </div>

                    <div className="max-h-[38rem] overflow-y-auto divide-y divide-border/70">
                        {(Array.isArray(data?.automations) ? data.automations : []).length === 0 ? (
                            <div className="px-4 sm:px-6 py-12 text-center text-sm text-muted-foreground">No automation updates available.</div>
                        ) : (
                            (Array.isArray(data?.automations) ? data.automations : []).map((item: any) => (
                                <div key={item.id} className="px-4 py-4 sm:px-6 sm:py-5 lg:px-7">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <p className="truncate text-sm font-bold text-foreground">{item.title || 'Untitled automation'}</p>
                                                <span className={cn(
                                                    'rounded-full px-2.5 py-1 text-[10px] font-black',
                                                    item.is_active ? 'bg-success-muted/80 text-success' : 'bg-muted text-muted-foreground'
                                                )}>
                                                    {item.is_active ? 'Active' : 'Paused'}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span className="rounded-full border border-border bg-background/70 px-3 py-1">{item.automation_type || 'Type'}</span>
                                                <span className="rounded-full border border-border bg-background/70 px-3 py-1">{item.account_id || 'No account'}</span>
                                                {item.keyword && (
                                                    <span className="rounded-full border border-border bg-background/70 px-3 py-1">Keyword: {item.keyword}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <section className={`${surfaceClass} p-4 sm:p-6 lg:p-7`}>
                <div className="mb-4 sm:mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Automation Activity Trend</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Main automation overview</p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-foreground">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        30 day trend
                    </div>
                </div>

                <div className="h-[220px] sm:h-[280px] rounded-xl border border-border/70 bg-background/60 p-3 sm:p-4 shadow-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={Array.isArray(data?.trend_30_days) ? data.trend_30_days : []}>
                            <defs>
                                <linearGradient id="automationTrendFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#405DE6" stopOpacity={0.28} />
                                    <stop offset="100%" stopColor="#405DE6" stopOpacity={0.03} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgb(148 163 184 / 0.15)" vertical={false} />
                            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} allowDecimals={false} />
                            <Tooltip content={<AutomationTooltip />} />
                            <Area type="monotone" dataKey="value" stroke="#405DE6" strokeWidth={2.5} fill="url(#automationTrendFill)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
};

export default AutomationsPage;
