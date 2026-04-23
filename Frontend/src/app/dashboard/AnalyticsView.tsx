"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Download, Loader2, RefreshCw, Clock3, UserCircle2, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../components/ui/card';
import Gauge from '../../components/ui/gauge';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';

interface ActivityLogItem {
    id: string;
    account_id: string;
    recipient_id: string;
    sender_name?: string;
    automation_id: string;
    automation_type: string;
    event_type: string;
    source: string;
    status: string;
    message: string;
    error_reason?: string;
    payload: unknown;
    sent_at: string;
    created_at: string;
}

const formatNumber = (value: number): string => {
    if (!Number.isFinite(value)) return '0';
    return new Intl.NumberFormat().format(value);
};

const formatDateTime = (raw: string): string => {
    if (!raw) return '-';
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString();
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const TRAFFIC_WINDOWS = [
    { value: '24h', label: 'Last 24 hrs' },
    { value: '7d', label: 'Last 7 days' },
    { value: '14d', label: 'Last 14 days' },
    { value: '21d', label: 'Last 21 days' },
    { value: '30d', label: 'Last 30 days' }
] as const;

const statusClasses = (status: string): string => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'success') return 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30';
    if (normalized === 'failed') return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30';
    if (normalized === 'skipped') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    return 'bg-muted text-muted-foreground border-border';
};

const AnalyticsTooltip = ({
    active,
    payload,
    label
}: {
    active?: boolean;
    payload?: Array<{ value?: number; name?: string; color?: string }>;
    label?: string;
}) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-2xl border border-content/70 bg-card/95 px-4 py-3 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl">
            {label && <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>}
            <div className="mt-2 space-y-2">
                {payload.map((entry, index) => (
                    <div key={`${entry.name || 'value'}-${index}`} className="flex items-center justify-between gap-4 text-xs">
                        <span className="flex items-center gap-2 text-foreground">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color || '#38bdf8' }} />
                            <span className="font-bold">{entry.name || 'Count'}</span>
                        </span>
                        <span className="font-black text-foreground">{formatNumber(Number(entry.value || 0))}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ActionLimitGaugeCard = ({
    label,
    value,
    max,
    updatedText
}: {
    label: string;
    value: number;
    max: number;
    updatedText: string;
}) => (
    <Card
        variant="elevated"
        className="relative flex flex-col aspect-[4/5] sm:aspect-square group ig-card"
    >
        <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10">
            <h3 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
            </h3>
        </div>
        <div className="flex-1 flex items-center justify-center pt-4">
            <Gauge
                value={value}
                max={max}
                size="lg"
                syncId="analytics-action-limits"
                updatedText={updatedText}
            />
        </div>
    </Card>
);

interface DonutSegment {
    key: string;
    label: string;
    value: number;
    color: string;
    muted?: boolean;
}

const DONUT_SIZE = 280;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_OUTER_RADIUS = 112;
const DONUT_INNER_RADIUS = 58;

const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(angleInRadians),
        y: cy + radius * Math.sin(angleInRadians)
    };
};

const describeDonutArc = (
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
    endAngle: number
) => {
    const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
    const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerStart.x} ${innerStart.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
        'Z'
    ].join(' ');
};

const DonutChartCard = ({
    eyebrow,
    title,
    description,
    segments,
    progress,
    defaultCenterTitle,
    defaultCenterValue,
    defaultCenterCaption,
    emptyCenterTitle = 'No Data'
}: {
    eyebrow: string;
    title: string;
    description: string;
    segments: DonutSegment[];
    progress: number;
    defaultCenterTitle: string;
    defaultCenterValue: string;
    defaultCenterCaption: string;
    emptyCenterTitle?: string;
}) => {
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);

    const chartState = useMemo(() => {
        const filtered = segments.filter((segment) => segment.value > 0);
        const total = filtered.reduce((sum, segment) => sum + segment.value, 0);
        const displaySegments = total > 0
            ? filtered
            : [{ key: 'empty', label: emptyCenterTitle, value: 1, color: 'rgb(226 232 240)', muted: true }];
        const displayTotal = displaySegments.reduce((sum, item) => sum + item.value, 0);
        let cursor = 0;

        return {
            total,
            segments: displaySegments.map((segment) => {
                const fullSpan = (segment.value / displayTotal) * 360;
                const scaledSpan = fullSpan * progress;
                const gapAngle = total > 0 ? Math.min(3.2, scaledSpan * 0.14) : 0;
                const startAngle = cursor + (gapAngle / 2);
                const endAngle = Math.max(startAngle + 0.1, cursor + scaledSpan - (gapAngle / 2));
                cursor += scaledSpan;
                return {
                    ...segment,
                    startAngle,
                    endAngle,
                    midAngle: startAngle + ((endAngle - startAngle) / 2),
                    percent: total > 0 ? Math.round((segment.value / total) * 100) : 0
                };
            })
        };
    }, [segments, progress, emptyCenterTitle]);

    const hoveredSegment = chartState.segments.find((segment) => segment.key === hoveredKey && !segment.muted) || null;
    const centerTitle = hoveredSegment ? hoveredSegment.label : (chartState.total > 0 ? defaultCenterTitle : emptyCenterTitle);
    const centerValue = hoveredSegment ? formatNumber(hoveredSegment.value) : (chartState.total > 0 ? defaultCenterValue : '0');
    const centerCaption = hoveredSegment
        ? `${hoveredSegment.percent}% of ${formatNumber(chartState.total)} logs`
        : defaultCenterCaption;

    const hoveredPointer = hoveredSegment
        ? {
            start: polarToCartesian(DONUT_CENTER, DONUT_CENTER, DONUT_OUTER_RADIUS - 10, hoveredSegment.midAngle),
            end: polarToCartesian(DONUT_CENTER, DONUT_CENTER, 18, hoveredSegment.midAngle)
        }
        : null;

    return (
        <Card className="relative overflow-hidden rounded-[2.2rem] border border-content/70 bg-card/95 p-6 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.38)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_52%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_46%)]" />
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="relative z-10 flex items-center justify-center">
                    <div className="relative flex aspect-square w-full max-w-[320px] items-center justify-center rounded-full border border-content/60 bg-background/60 backdrop-blur-xl shadow-[0_30px_80px_-44px_rgba(14,165,233,0.38)] dark:bg-background/20">
                        <div className="absolute inset-[10%] rounded-full border border-content/60" />
                        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_62%)] dark:bg-[radial-gradient(circle,rgba(56,189,248,0.10),transparent_62%)]" />
                        <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className="relative z-10 h-[87.5%] w-[87.5%] drop-shadow-[0_16px_44px_rgba(15,23,42,0.16)]">
                            <circle
                                cx={DONUT_CENTER}
                                cy={DONUT_CENTER}
                                r={DONUT_OUTER_RADIUS}
                                fill="transparent"
                                stroke="rgba(148,163,184,0.14)"
                                strokeWidth="26"
                            />
                            {chartState.segments.map((segment) => {
                                const isHovered = hoveredSegment?.key === segment.key;
                                const outerRadius = isHovered ? DONUT_OUTER_RADIUS + 3 : DONUT_OUTER_RADIUS;
                                const innerRadius = isHovered ? DONUT_INNER_RADIUS - 2 : DONUT_INNER_RADIUS;
                                const path = describeDonutArc(
                                    DONUT_CENTER,
                                    DONUT_CENTER,
                                    outerRadius,
                                    innerRadius,
                                    segment.startAngle,
                                    segment.endAngle
                                );

                                return (
                                    <path
                                        key={segment.key}
                                        d={path}
                                        fill={segment.color}
                                        opacity={segment.muted ? 0.45 : isHovered ? 1 : 0.9}
                                        className="transition-all duration-200"
                                        onMouseEnter={() => !segment.muted && setHoveredKey(segment.key)}
                                        onMouseLeave={() => setHoveredKey((current) => (current === segment.key ? null : current))}
                                    />
                                );
                            })}
                            {hoveredPointer && hoveredSegment && (
                                <>
                                    <line
                                        x1={hoveredPointer.start.x}
                                        y1={hoveredPointer.start.y}
                                        x2={hoveredPointer.end.x}
                                        y2={hoveredPointer.end.y}
                                        stroke={hoveredSegment.color}
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                        opacity="0.18"
                                    />
                                    <line
                                        x1={hoveredPointer.start.x}
                                        y1={hoveredPointer.start.y}
                                        x2={hoveredPointer.end.x}
                                        y2={hoveredPointer.end.y}
                                        stroke={hoveredSegment.color}
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        opacity="0.96"
                                    />
                                </>
                            )}
                        </svg>
                        <div className="absolute inset-[23%] z-20 flex flex-col items-center justify-center rounded-full border border-content/60 bg-card/95 px-4 text-center shadow-[0_24px_45px_-30px_rgba(15,23,42,0.42)] dark:bg-card/90 sm:px-6">
                            <div className="h-2.5 w-2.5 rounded-full bg-primary/80 shadow-[0_0_24px_rgba(59,130,246,0.7)]" />
                            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{centerTitle}</p>
                            <p className="mt-1 text-2xl font-black text-foreground sm:text-3xl">{centerValue}</p>
                            <p className="mt-1 max-w-[11rem] text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">{centerCaption}</p>
                        </div>
                    </div>
                </div>
                <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
                    <h2 className="mt-2 text-xl font-black text-foreground">{title}</h2>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
                    <div className={`mt-6 grid gap-3 ${chartState.segments.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
                        {chartState.segments.map((segment) => (
                            <button
                                key={segment.key}
                                type="button"
                                onMouseEnter={() => !segment.muted && setHoveredKey(segment.key)}
                                onMouseLeave={() => setHoveredKey((current) => (current === segment.key ? null : current))}
                                className={`min-h-[104px] rounded-[1.5rem] border px-4 py-4 text-left transition-all ${segment.muted ? 'border-border bg-muted/70 text-muted-foreground cursor-default' : 'border-content/55 bg-background/70 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(15,23,42,0.35)] dark:bg-background/25'}`}
                                style={segment.muted ? undefined : {
                                    borderColor: hoveredSegment?.key === segment.key ? `${segment.color}88` : `${segment.color}40`,
                                    backgroundColor: hoveredSegment?.key === segment.key ? `${segment.color}20` : `${segment.color}12`
                                }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-foreground">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                                        {segment.label}
                                    </div>
                                    <span className="text-[11px] font-black" style={segment.muted ? undefined : { color: segment.color }}>
                                        {segment.muted ? '0%' : `${segment.percent}%`}
                                    </span>
                                </div>
                                <p className="mt-3 text-2xl font-black text-foreground">{segment.muted ? '0' : formatNumber(segment.value)}</p>
                                <div className="mt-3 h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/80 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: `${segment.muted ? 100 : segment.percent}%`,
                                            backgroundColor: segment.color
                                        }}
                                    />
                                </div>
                                <p className="mt-2 text-[10px] font-medium text-muted-foreground">
                                    {segment.muted ? 'No logs matched this chart yet.' : `${segment.percent}% share of the current window.`}
                                </p>
                            </button>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                        <span className="rounded-full border border-content/70 bg-background/70 px-3 py-1.5">
                            Total logs: <span className="font-black text-foreground">{formatNumber(chartState.total)}</span>
                        </span>
                        <span className="rounded-full border border-content/70 bg-background/70 px-3 py-1.5">
                            Hover a segment to inspect the center value
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

const AnalyticsView: React.FC = () => {
    const {
        activeAccountID,
        activeAccount,
        analyticsDateRange,
        setAnalyticsDateRange
    } = useDashboard();
    const { authenticatedFetch } = useAuth();

    const [logs, setLogs] = useState<ActivityLogItem[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshingAll, setRefreshingAll] = useState(false);
    const [downloadingCsv, setDownloadingCsv] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pieProgress, setPieProgress] = useState(0);
    const [trafficWindow, setTrafficWindow] = useState<(typeof TRAFFIC_WINDOWS)[number]['value']>('24h');
    const [trafficMenuOpen, setTrafficMenuOpen] = useState(false);
    const trafficMenuRef = useRef<HTMLDivElement | null>(null);

    const fetchLogs = useCallback(async () => {
        if (!activeAccountID) {
            setLogs([]);
            return;
        }
        setLoadingLogs(true);
        try {
            const params = new URLSearchParams({
                account_id: String(activeAccountID),
                start_date: analyticsDateRange.start,
                end_date: analyticsDateRange.end,
                limit: '200'
            });
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automation-activity-log?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Failed to fetch automation activity log.');
            }
            const data = await res.json();
            setLogs(Array.isArray(data?.logs) ? data.logs : []);
        } finally {
            setLoadingLogs(false);
        }
    }, [activeAccountID, analyticsDateRange.end, analyticsDateRange.start, authenticatedFetch]);

    const fetchAll = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
        if (mode === 'initial') setInitialLoading(true);
        else setRefreshingAll(true);
        setError(null);
        try {
            await fetchLogs();
        } catch (err: any) {
            setError(String(err?.message || 'Failed to load analytics.'));
        } finally {
            if (mode === 'initial') setInitialLoading(false);
            else setRefreshingAll(false);
        }
    }, [fetchLogs]);

    useEffect(() => {
        fetchAll('initial');
    }, [fetchAll]);

    useEffect(() => {
        if (initialLoading) return;
        setPieProgress(0);
        const id = window.setTimeout(() => setPieProgress(1), 80);
        return () => window.clearTimeout(id);
    }, [logs, initialLoading]);

    useEffect(() => {
        if (!trafficMenuOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (trafficMenuRef.current && !trafficMenuRef.current.contains(event.target as Node)) {
                setTrafficMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [trafficMenuOpen]);

    const metrics = useMemo(() => {
        const total = logs.length;
        const directSuccess = logs.filter((l) => String(l.status || '').toLowerCase() === 'success').length;
        const failed = logs.filter((l) => String(l.status || '').toLowerCase() === 'failed').length;
        const skipped = logs.filter((l) => String(l.status || '').toLowerCase() === 'skipped').length;
        const success = directSuccess;
        const effectiveSuccess = directSuccess + skipped;
        const successRate = total > 0 ? (effectiveSuccess / total) * 100 : 0;
        const deliveryHealth = successRate;
        const failurePressure = total > 0 ? (failed / total) * 100 : 0;
        return {
            total,
            success,
            failed,
            skipped,
            successRate: clampPercent(successRate),
            deliveryHealth: clampPercent(deliveryHealth),
            failurePressure: clampPercent(100 - failurePressure),
        };
    }, [logs]);

    const performanceSegments = useMemo<DonutSegment[]>(() => ([
        { key: 'success', label: 'Success', value: metrics.success, color: 'rgb(34 197 94)' },
        { key: 'failed', label: 'Failed', value: metrics.failed, color: 'rgb(239 68 68)' },
        { key: 'skipped', label: 'Skipped', value: metrics.skipped, color: 'rgb(245 158 11)' }
    ]), [metrics.failed, metrics.skipped, metrics.success]);

    const automationTypeSegments = useMemo<DonutSegment[]>(() => {
        const palette = [
            'rgb(59 130 246)',
            'rgb(16 185 129)',
            'rgb(245 158 11)',
            'rgb(244 63 94)',
            'rgb(139 92 246)',
            'rgb(236 72 153)',
            'rgb(14 165 233)',
            'rgb(168 85 247)'
        ];
        const labelMap: Record<string, string> = {
            dm: 'DM',
            post: 'Post',
            comment: 'Post',
            reel: 'Reel',
            story: 'Story',
            live: 'Live',
            global: 'Global Trigger',
            welcome_message: 'Welcome Message',
            mention: 'Mention'
        };
        const counts = new Map<string, number>();

        logs.forEach((log) => {
            const rawType = String(log.automation_type || '').trim().toLowerCase() || 'unknown';
            counts.set(rawType, (counts.get(rawType) || 0) + 1);
        });

        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([key, value], index) => ({
                key,
                label: labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
                value,
                color: palette[index % palette.length]
            }));
    }, [logs]);

    const actionLimitStats = useMemo(() => {
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;
        const dayMs = 24 * hourMs;
        const monthMs = 30 * dayMs;
        const safeLogs = Array.isArray(logs) ? logs : [];

        const countInWindow = (windowMs: number) => safeLogs.reduce((count, log) => {
            const raw = log.sent_at || log.created_at;
            if (!raw) return count;
            const ts = new Date(raw).getTime();
            if (Number.isNaN(ts)) return count;
            return ts >= now - windowMs ? count + 1 : count;
        }, 0);

        const hourlyLimit = Number(activeAccount?.hourly_action_limit || 0);
        const dailyLimit = Number(activeAccount?.daily_action_limit || 0);
        const monthlyLimit = Number(activeAccount?.monthly_action_limit || 0);

        return {
            hour: {
                value: countInWindow(hourMs),
                max: hourlyLimit > 0 ? hourlyLimit : 100
            },
            day: {
                value: countInWindow(dayMs),
                max: dailyLimit > 0 ? dailyLimit : 1000
            },
            month: {
                value: countInWindow(monthMs),
                max: monthlyLimit > 0 ? monthlyLimit : 10000
            }
        };
    }, [activeAccount?.daily_action_limit, activeAccount?.hourly_action_limit, activeAccount?.monthly_action_limit, logs]);

    const trafficData = useMemo(() => {
        const now = new Date();
        if (trafficWindow === '24h') {
            const buckets = Array.from({ length: 24 }, (_, idx) => {
                const date = new Date(now.getTime() - (23 - idx) * 60 * 60 * 1000);
                return {
                    label: date.toLocaleTimeString([], { hour: 'numeric' }),
                    count: 0
                };
            });

            logs.forEach((log) => {
                const raw = log.sent_at || log.created_at;
                if (!raw) return;
                const ts = new Date(raw).getTime();
                if (Number.isNaN(ts)) return;
                const diffHours = Math.floor((now.getTime() - ts) / (60 * 60 * 1000));
                if (diffHours < 0 || diffHours > 23) return;
                const idx = 23 - diffHours;
                if (buckets[idx]) buckets[idx].count += 1;
            });

            return buckets;
        }

        const totalDays = Number(trafficWindow.replace('d', '')) || 7;
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        const buckets = Array.from({ length: totalDays }, (_, idx) => {
            const date = new Date(endOfToday);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - (totalDays - 1 - idx));
            return {
                label: date.toLocaleDateString([], { day: '2-digit', month: 'short' }),
                count: 0,
                start: date.getTime(),
                end: date.getTime() + (24 * 60 * 60 * 1000)
            };
        });

        logs.forEach((log) => {
            const raw = log.sent_at || log.created_at;
            if (!raw) return;
            const ts = new Date(raw).getTime();
            if (Number.isNaN(ts)) return;
            const bucket = buckets.find((item) => ts >= item.start && ts < item.end);
            if (bucket) bucket.count += 1;
        });

        return buckets.map(({ label, count }) => ({ label, count }));
    }, [logs, trafficWindow]);

    const selectedTrafficWindow = TRAFFIC_WINDOWS.find((item) => item.value === trafficWindow)?.label || 'Last 24 hrs';

    const failureReasonSummary = useMemo(() => {
        const failedLogs = logs.filter((row) => String(row.status || '').toLowerCase() === 'failed');
        const counts = new Map<string, number>();
        failedLogs.forEach((row) => {
            const reason = String(row.error_reason || '').trim() || 'Unknown failure reason';
            counts.set(reason, (counts.get(reason) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
            .slice(0, 8);
    }, [logs]);

    const handleDownloadCsv = useCallback(async () => {
        if (!activeAccountID) return;
        setDownloadingCsv(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                account_id: String(activeAccountID),
                start_date: analyticsDateRange.start,
                end_date: analyticsDateRange.end,
                limit: '5000'
            });
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automation-activity-log/csv?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Failed to export automation activity log CSV.');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const fileName = `automation_activity_log_${activeAccountID}_${analyticsDateRange.start}_${analyticsDateRange.end}.csv`;
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(String(err?.message || 'Failed to export CSV.'));
        } finally {
            setDownloadingCsv(false);
        }
    }, [activeAccountID, analyticsDateRange.end, analyticsDateRange.start, authenticatedFetch]);

    if (!activeAccountID) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
                <Card className="p-8 border border-content rounded-3xl text-center">
                    <p className="text-sm font-bold text-muted-foreground">Select an Instagram account to view analytics.</p>
                </Card>
            </div>
        );
    }

    if (initialLoading || (loadingLogs && !logs.length)) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Loading Analytics"
                subMessage="Preparing activity logs and action-limit insights..."
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Analytics</p>
                    <h1 className="text-3xl font-black text-foreground mt-1">
                        {activeAccount?.username ? `@${activeAccount.username}` : 'Instagram Account'}
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-content bg-card px-3 py-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="date"
                            value={analyticsDateRange.start}
                            onChange={(e) => setAnalyticsDateRange((prev) => ({ ...prev, start: e.target.value }))}
                            className="bg-transparent text-xs font-bold text-foreground outline-none"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <input
                            type="date"
                            value={analyticsDateRange.end}
                            onChange={(e) => setAnalyticsDateRange((prev) => ({ ...prev, end: e.target.value }))}
                            className="bg-transparent text-xs font-bold text-foreground outline-none"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchAll('refresh')}
                        disabled={loadingLogs || refreshingAll}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                        {(loadingLogs || refreshingAll)
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <RefreshCw className="w-4 h-4" />}
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <Card className="p-4 border border-destructive/30 bg-destructive/10 rounded-2xl">
                    <p className="text-xs font-bold text-destructive">{error}</p>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <ActionLimitGaugeCard
                    label="Hourly Action Limit"
                    value={actionLimitStats.hour.value}
                    max={actionLimitStats.hour.max}
                    updatedText={`${actionLimitStats.hour.value}/${actionLimitStats.hour.max} in last hour`}
                />
                <ActionLimitGaugeCard
                    label="Daily Action Limit"
                    value={actionLimitStats.day.value}
                    max={actionLimitStats.day.max}
                    updatedText={`${actionLimitStats.day.value}/${actionLimitStats.day.max} in last 24h`}
                />
                <ActionLimitGaugeCard
                    label="Monthly Action Limit"
                    value={actionLimitStats.month.value}
                    max={actionLimitStats.month.max}
                    updatedText={`${actionLimitStats.month.value}/${actionLimitStats.month.max} in last 30d`}
                />
            </div>

            <DonutChartCard
                eyebrow="Performance Split"
                title="Automation Success vs Failure"
                description="Hover any slice to inspect that outcome count in the center."
                segments={performanceSegments}
                progress={pieProgress}
                defaultCenterTitle="Success Rate"
                defaultCenterValue={`${metrics.successRate.toFixed(0)}%`}
                defaultCenterCaption={`${formatNumber(metrics.total)} total logs`}
            />

            <DonutChartCard
                eyebrow="Automation Mix"
                title="Automation Count by Type"
                description="A matching pie chart showing how your activity logs are distributed across automation types."
                segments={automationTypeSegments}
                progress={pieProgress}
                defaultCenterTitle="Automation Types"
                defaultCenterValue={formatNumber(automationTypeSegments.length)}
                defaultCenterCaption={`${formatNumber(metrics.total)} total logs`}
            />

            <Card className="p-6 border border-content rounded-3xl bg-card/95">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Automation Traffic</p>
                        <h2 className="mt-1 text-xl font-black text-foreground">{selectedTrafficWindow}</h2>
                        <p className="text-xs text-muted-foreground">
                            {trafficWindow === '24h' ? 'Hourly automation activity volume.' : 'Daily automation activity volume.'}
                        </p>
                    </div>
                    <div ref={trafficMenuRef} className="w-full sm:max-w-[220px]">
                        <span className="mb-2 inline-flex text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Period</span>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setTrafficMenuOpen((current) => !current)}
                                className="group relative flex h-11 w-full items-center justify-between overflow-hidden rounded-2xl border border-border/80 bg-background/90 px-3.5 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.7)] transition-all hover:border-primary/35 hover:bg-card dark:bg-slate-950/70 dark:hover:bg-slate-900/90"
                            >
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_36%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.12),transparent_36%)]" />
                                <div className="relative min-w-0 pr-2">
                                    <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-foreground transition-colors group-hover:text-primary">
                                        {selectedTrafficWindow}
                                    </p>
                                </div>
                                <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border/70 bg-card/80 transition-colors group-hover:border-primary/35 dark:bg-slate-900/80">
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${trafficMenuOpen ? 'rotate-180 text-primary' : ''}`} />
                                </span>
                            </button>
                            {trafficMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setTrafficMenuOpen(false)} />
                                    <div className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-[1.35rem] border border-border/80 bg-card/98 p-1.5 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl">
                                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.14),transparent_38%)]" />
                                        <div className="relative space-y-1">
                                            {TRAFFIC_WINDOWS.map((option) => {
                                                const active = option.value === trafficWindow;

                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setTrafficWindow(option.value);
                                                            setTrafficMenuOpen(false);
                                                        }}
                                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                                                            active
                                                                ? 'bg-primary text-primary-foreground shadow-[0_18px_34px_-24px_rgba(99,102,241,0.9)]'
                                                                : 'text-foreground hover:bg-background/80 hover:text-primary'
                                                        }`}
                                                    >
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.14em]">{option.label}</p>
                                                            <p className={`mt-0.5 text-[9px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                                                {option.value === '24h' ? 'Hourly activity view' : 'Daily activity view'}
                                                            </p>
                                                        </div>
                                                        <span className={`h-2 w-2 rounded-full ${active ? 'bg-primary-foreground' : 'bg-primary/40'}`} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trafficData}>
                            <defs>
                                <linearGradient id="trafficGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                                    <stop offset="50%" stopColor="#38bdf8" stopOpacity={0.4} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                                </linearGradient>
                                <filter id="trafficGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 2 }}
                                content={<AnalyticsTooltip />}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="url(#trafficGradient)"
                                strokeWidth={3}
                                dot={false}
                                filter="url(#trafficGlow)"
                                isAnimationActive
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="relative overflow-hidden p-0 border border-content rounded-3xl bg-gradient-to-br from-slate-500/10 via-zinc-500/5 to-sky-500/10">
                <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-sky-500/20 blur-3xl" />
                <div className="absolute -left-12 -bottom-12 w-44 h-44 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="relative p-6 border-b border-content/60 bg-card/60 backdrop-blur-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
                                    Automation Activity Log
                                </h2>
                                <Clock3 className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                                <span className="rounded-full border border-content bg-card/80 px-2.5 py-1 text-muted-foreground">
                                    Total: {formatNumber(metrics.total)}
                                </span>
                                <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-green-700 dark:text-green-300">
                                    Success: {formatNumber(metrics.success)}
                                </span>
                                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-700 dark:text-red-300">
                                    Failed: {formatNumber(metrics.failed)}
                                </span>
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
                                    Skipped: {formatNumber(metrics.skipped)}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleDownloadCsv}
                            disabled={downloadingCsv || loadingLogs}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-content bg-card/85 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-card disabled:opacity-60 shadow-sm"
                        >
                            {downloadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            CSV
                        </button>
                    </div>
                </div>

                <div className="relative px-6 py-4 border-b border-content/50 bg-card/50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Failure Reasons</p>
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                            {formatNumber(metrics.failed)} failed
                        </span>
                    </div>
                    {failureReasonSummary.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No failures in this date range.</p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {failureReasonSummary.map((item, idx) => (
                                <div key={`${item.reason}-${idx}`} className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                                    <p className="text-[11px] font-bold text-foreground leading-relaxed">{item.reason}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{item.count} occurrence{item.count === 1 ? '' : 's'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {loadingLogs ? (
                    <div className="py-10 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : logs.length === 0 ? (
                    <p className="px-6 py-6 text-xs font-bold text-muted-foreground">No logs found for the selected date range.</p>
                ) : (
                    <div className="p-4 sm:p-5 space-y-3 max-h-[620px] overflow-auto">
                        {logs.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-content/70 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm hover:shadow-md transition-all">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-1.5 h-9 rounded-full bg-gradient-to-b from-cyan-500 via-blue-500 to-indigo-500" />
                                        <span className="text-xs font-black text-foreground uppercase tracking-wide">
                                            {row.event_type || row.automation_type || 'event'}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full border ${statusClasses(row.status)}`}>
                                            {row.status || 'unknown'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground rounded-full border border-content/70 bg-card px-2.5 py-1">
                                        {formatDateTime(row.sent_at)}
                                    </span>
                                </div>
                                <p className="mt-2.5 text-xs leading-relaxed text-foreground/90">
                                    {row.message || 'No message'}
                                </p>
                                {String(row.status || '').toLowerCase() === 'failed' && String(row.error_reason || '').trim() && (
                                    <p className="mt-1.5 text-xs leading-relaxed text-red-600 dark:text-red-400">
                                        Error reason: {String(row.error_reason || '').trim()}
                                    </p>
                                )}
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                                    <span className="rounded-xl border border-content/60 bg-card/70 px-2.5 py-1.5"><span className="font-bold">Source:</span> {row.source || '-'}</span>
                                    <span className="rounded-xl border border-content/60 bg-card/70 px-2.5 py-1.5"><span className="font-bold">Automation:</span> {row.automation_type || '-'}</span>
                                    <span className="rounded-xl border border-content/60 bg-card/70 px-2.5 py-1.5"><span className="font-bold">Recipient:</span> {row.recipient_id || '-'}</span>
                                    <span className="inline-flex items-center gap-1 rounded-xl border border-content/60 bg-card/70 px-2.5 py-1.5"><UserCircle2 className="w-3 h-3" /><span className="font-bold">Sender:</span> {row.sender_name || '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default AnalyticsView;
