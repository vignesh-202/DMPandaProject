import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Layers3, Sparkles, TrendingUp } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const numberFormatter = new Intl.NumberFormat('en-IN');
const surfaceClass = 'glass-card rounded-[30px] border border-border/70 bg-card/95';

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
        <div className="rounded-[20px] border border-border/80 bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-black text-muted-foreground">{label}</p>
            <p className="mt-2 text-sm font-bold text-foreground">{numberFormatter.format(Number(payload[0]?.value || 0))} automations</p>
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
            tone: 'text-success bg-success/10'
        },
        {
            label: 'Templates',
            value: numberFormatter.format(Number(data?.summary?.with_templates || 0)),
            icon: Activity,
            tone: 'text-warning bg-warning/15'
        }
    ]), [data]);

    if (loading) {
        return <AdminLoadingState title="Loading automations" description="Collecting automation totals, types, and the latest rule changes." />;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className={`${surfaceClass} overflow-hidden p-6 sm:p-8`}>
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_360px] xl:items-start">
                    <div>
                        <p className="text-[10px] font-black text-primary/75">Automation</p>
                        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Automation Control</h1>
                        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
                            Review automation volume, active coverage, and the latest rule updates in one clear workspace.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                        {summaryCards.map((card) => (
                            <div key={card.label} className="rounded-[26px] border border-border/70 bg-background/70 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', card.tone)}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                    <p className="text-right text-[10px] font-black text-muted-foreground">{card.label}</p>
                                </div>
                                <p className="mt-5 text-3xl font-extrabold tracking-tight text-foreground">{card.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.78fr,1.22fr]">
                <div className={`${surfaceClass} p-6 sm:p-7`}>
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">Type Mix</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Current count</p>
                        </div>
                        <div className="status-pill border border-border bg-background/70 text-foreground">
                            <Layers3 className="h-3.5 w-3.5 text-primary" />
                            Live summary
                        </div>
                    </div>

                    <div className="space-y-3">
                        {(Array.isArray(data?.by_type) ? data.by_type : []).length === 0 ? (
                            <div className="rounded-[22px] border border-dashed border-border bg-background/60 px-4 py-6 text-center text-sm font-medium text-muted-foreground">
                                No automation types available yet.
                            </div>
                        ) : (
                            (Array.isArray(data?.by_type) ? data.by_type : []).map((item: any, index: number) => (
                                <div key={item.name} className="rounded-[22px] border border-border/70 bg-background/60 px-4 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className={cn(
                                                'h-2.5 w-2.5 rounded-full',
                                                index % 3 === 0 ? 'bg-primary' : index % 3 === 1 ? 'bg-success' : 'bg-warning'
                                            )} />
                                            <span className="truncate text-sm font-bold text-foreground">{item.name}</span>
                                        </div>
                                        <span className="text-sm font-black text-foreground">{numberFormatter.format(Number(item.value || 0))}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={`${surfaceClass} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-border/70 px-6 py-5 sm:px-7">
                        <div>
                            <h2 className="text-xl font-extrabold text-foreground">Recent Updates</h2>
                            <p className="mt-1 text-xs font-black text-muted-foreground">Latest changes</p>
                        </div>
                        <div className="status-pill border border-border bg-background/70 text-foreground">
                            <Clock3 className="h-3.5 w-3.5 text-primary" />
                            Most recent first
                        </div>
                    </div>

                    <div className="max-h-[38rem] overflow-y-auto divide-y divide-border/70">
                        {(Array.isArray(data?.automations) ? data.automations : []).length === 0 ? (
                            <div className="px-6 py-12 text-center text-sm text-muted-foreground">No automation updates available.</div>
                        ) : (
                            (Array.isArray(data?.automations) ? data.automations : []).map((item: any) => (
                                <div key={item.id} className="px-6 py-5 sm:px-7">
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

            <section className={`${surfaceClass} p-6 sm:p-7`}>
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-foreground">Automation Activity Trend</h2>
                        <p className="mt-1 text-xs font-black text-muted-foreground">Main automation overview</p>
                    </div>
                    <div className="status-pill border border-border bg-background/70 text-foreground">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        30 day trend
                    </div>
                </div>

                <div className="h-[280px] rounded-[24px] border border-border/70 bg-background/60 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={Array.isArray(data?.trend_30_days) ? data.trend_30_days : []}>
                            <defs>
                                <linearGradient id="automationTrendFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#405DE6" stopOpacity={0.38} />
                                    <stop offset="100%" stopColor="#405DE6" stopOpacity={0.04} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgb(148 163 184 / 0.15)" vertical={false} />
                            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} allowDecimals={false} />
                            <Tooltip content={<AutomationTooltip />} />
                            <Area type="monotone" dataKey="value" stroke="#405DE6" strokeWidth={3} fill="url(#automationTrendFill)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
};

export default AutomationsPage;
