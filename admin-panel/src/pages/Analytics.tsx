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
    ChevronDown,
    ArrowDownRight,
    ArrowUpRight,
    RefreshCw
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
    CartesianGrid
} from 'recharts';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminGauge from '../components/ui/AdminGauge';

const CHART_COLORS = [
    'rgb(59 130 246)',
    'rgb(16 185 129)',
    'rgb(245 158 11)',
    'rgb(244 63 94)',
    'rgb(139 92 246)',
    'rgb(236 72 153)',
    'rgb(14 165 233)',
    'rgb(168 85 247)'
];
const TRAFFIC_SERIES_COLORS = {
    total: '#38bdf8',
    successful: '#22c55e',
    failed: '#ef4444',
    rollingAverage: '#94a3b8'
} as const;
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
interface DonutSegment {
    key: string;
    label: string;
    value: number;
    color: string;
    muted?: boolean;
}

const moneyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('en-IN');

const surfaceClass = 'glass-card rounded-[32px] border border-border/70 bg-card/95 shadow-[0_22px_65px_rgba(15,23,42,0.07)]';
const chartGridStroke = 'rgb(148 163 184 / 0.18)';
const DONUT_SIZE = 280;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_OUTER_RADIUS = 112;
const DONUT_INNER_RADIUS = 58;

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
    const centerValue = hoveredSegment ? numberFormatter.format(hoveredSegment.value) : (chartState.total > 0 ? defaultCenterValue : '0');
    const centerCaption = hoveredSegment
        ? `${hoveredSegment.percent}% of ${numberFormatter.format(chartState.total)} logs`
        : defaultCenterCaption;

    const hoveredPointer = hoveredSegment
        ? {
            start: polarToCartesian(DONUT_CENTER, DONUT_CENTER, DONUT_OUTER_RADIUS - 10, hoveredSegment.midAngle),
            end: polarToCartesian(DONUT_CENTER, DONUT_CENTER, 18, hoveredSegment.midAngle)
        }
        : null;

    return (
        <div className="relative overflow-hidden rounded-[2.2rem] border border-border/70 bg-card/95 p-6 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.38)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_52%)]" />
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="relative z-10 flex items-center justify-center">
                    <div className="relative flex aspect-square w-full max-w-[320px] items-center justify-center rounded-full border border-border/60 bg-background/60 backdrop-blur-xl shadow-[0_30px_80px_-44px_rgba(14,165,233,0.38)]">
                        <div className="absolute inset-[10%] rounded-full border border-border/60" />
                        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_62%)]" />
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
                            {hoveredPointer && hoveredSegment ? (
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
                            ) : null}
                        </svg>
                        <div className="absolute inset-[23%] z-20 flex flex-col items-center justify-center rounded-full border border-border/60 bg-card/95 px-4 text-center shadow-[0_24px_45px_-30px_rgba(15,23,42,0.42)] sm:px-6">
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
                                className={`min-h-[104px] rounded-[1.5rem] border px-4 py-4 text-left transition-all ${segment.muted ? 'cursor-default border-border bg-muted/70 text-muted-foreground' : 'border-border/55 bg-background/70 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(15,23,42,0.35)]'}`}
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
                                <p className="mt-3 text-2xl font-black text-foreground">{segment.muted ? '0' : numberFormatter.format(segment.value)}</p>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
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
                        <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">
                            Total logs: <span className="font-black text-foreground">{numberFormatter.format(chartState.total)}</span>
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">
                            Hover a segment to inspect the center value
                        </span>
                    </div>
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
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [pieProgress, setPieProgress] = useState(0);
    const hasLoadedOnceRef = useRef(false);
    const latestRequestRef = useRef(0);
    const revenueSectionRef = useRef<HTMLElement | null>(null);
    const automationSectionRef = useRef<HTMLElement | null>(null);
    const deferredData = useDeferredValue(data);
    const displayData = deferredData ?? data;

    useEffect(() => {
        setPieProgress(0);
        const id = window.setTimeout(() => setPieProgress(1), 80);
        return () => window.clearTimeout(id);
    }, [displayData?.log_status_breakdown]);

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
                setLastUpdatedAt(new Date());
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
    }, [refreshNonce, revenueCustomRange.end, revenueCustomRange.start, revenueWindow, trafficWindow]);

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
    const triggerRefresh = () => {
        if (loading || refreshing) return;
        setRefreshNonce((current) => current + 1);
    };
    const lastUpdatedLabel = lastUpdatedAt
        ? lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Waiting for first sync';
    const refreshSurfaceClass = refreshing
        ? 'relative overflow-hidden ring-1 ring-primary/10 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/80 before:to-transparent'
        : '';
    const trafficChartData = useMemo(() => {
        const source = Array.isArray(displayData?.automation_traffic) ? displayData.automation_traffic : [];
        return source.map((entry: any) => ({
            ...entry,
            value: Number(entry?.value || 0),
            successful: Number(entry?.successful || 0),
            failed: Number(entry?.failed || 0),
            skipped: Number(entry?.skipped || 0),
            rolling_average: Number(entry?.rolling_average || 0)
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
    const latestRevenue = (() => {
        const revenue = Array.isArray(displayData?.monthly_revenue) ? displayData.monthly_revenue : [];
        return revenue.length > 0 ? Number(revenue[revenue.length - 1]?.value || 0) : 0;
    })();
    const revenueTotalForWindow = Number(displayData?.revenue_total_for_window || 0);
    const trafficSummaryLabel = selectedTrafficWindow;
    const revenueSummaryLabel = revenueWindow === 'custom'
        ? `${revenueFilterMeta.start_date || revenueCustomRange.start} to ${revenueFilterMeta.end_date || revenueCustomRange.end}`
        : selectedRevenueWindow;
    const metaHourlyCapacity = Number(displayData?.meta_pool?.capacity_per_hour || 0);
    const metaLinkedAccounts = Number(displayData?.meta_pool?.linked_accounts || 0);
    const metaHourlyUsage = Number(displayData?.meta_pool?.usage_last_hour || displayData?.plan_pools?.hourly?.usage || displayData?.pool?.usage_last_hour || 0);
    const metaHourlyUsagePercent = Number(displayData?.meta_pool?.usage_percent || 0);
    const planHourlyCapacity = Number(displayData?.plan_pools?.hourly?.capacity || displayData?.pool?.capacity_per_hour || 0);
    const planHourlyUsage = Number(displayData?.plan_pools?.hourly?.usage || displayData?.pool?.usage_last_hour || 0);
    const planHourlyUsagePercent = Number(displayData?.plan_pools?.hourly?.usage_percent || displayData?.pool?.usage_percent || 0);
    const planDailyCapacity = Number(displayData?.plan_pools?.daily?.capacity || 0);
    const planDailyUsage = Number(displayData?.plan_pools?.daily?.usage || 0);
    const planDailyUsagePercent = Number(displayData?.plan_pools?.daily?.usage_percent || 0);
    const planMonthlyCapacity = Number(displayData?.plan_pools?.monthly?.capacity || 0);
    const planMonthlyUsage = Number(displayData?.plan_pools?.monthly?.usage || 0);
    const planMonthlyUsagePercent = Number(displayData?.plan_pools?.monthly?.usage_percent || 0);
    const hourlyBalanceValue = Number(displayData?.hourly_pool_balance?.gauge_value || 0);
    const hourlyBalanceMax = Number(displayData?.hourly_pool_balance?.gauge_max || metaHourlyCapacity || 0);
    const hourlyBalanceHelper = hourlyBalanceValue > metaHourlyCapacity
        ? `Sold hourly limits exceed Meta by ${numberFormatter.format(hourlyBalanceValue - metaHourlyCapacity)} actions/hour.`
        : metaHourlyCapacity > hourlyBalanceValue
            ? `Meta still has ${numberFormatter.format(metaHourlyCapacity - hourlyBalanceValue)} actions/hour of headroom.`
            : 'Meta and sold hourly plan limits are aligned.';
    const peakTrafficPoint = trafficChartData.reduce((peak: any, row: any) => {
        if (!peak || Number(row.value || 0) > Number(peak.value || 0)) return row;
        return peak;
    }, null);
    const failureShare = statusTotal > 0 ? Math.round((Number(failedCount || 0) / statusTotal) * 100) : 0;
    const averageSuccessfulTraffic = trafficChartData.length > 0
        ? trafficChartData.reduce((sum: number, row: any) => sum + Number(row.successful || 0), 0) / trafficChartData.length
        : 0;
    const deliveryOutcomeSegments: DonutSegment[] = [
        { key: 'success', label: 'Success', value: Number(successCount || 0), color: 'rgb(34 197 94)' },
        { key: 'failed', label: 'Failed', value: Number(failedCount || 0), color: 'rgb(239 68 68)' },
        { key: 'skipped', label: 'Skipped', value: Number(skippedCount || 0), color: 'rgb(245 158 11)' }
    ];
    const automationMixSegments: DonutSegment[] = (Array.isArray(displayData?.automations_by_type) ? displayData.automations_by_type : [])
        .filter((entry: PieDatum) => Number(entry?.value || 0) > 0)
        .map((entry: PieDatum, index: number) => ({
            key: String(entry.name || `type-${index}`),
            label: humanizeAnalyticsLabel(String(entry.name || 'Unknown')),
            value: Number(entry.value || 0),
            color: CHART_COLORS[index % CHART_COLORS.length]
        }));
    const scrollToSection = (sectionRef: React.RefObject<HTMLElement | null>) => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${refreshing ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-background/70 text-muted-foreground'}`}>
                            <span className={`h-2 w-2 rounded-full ${refreshing ? 'animate-pulse bg-primary' : 'bg-emerald-500'}`} />
                            {refreshing ? 'Refreshing live analytics' : `Last sync ${lastUpdatedLabel}`}
                        </div>
                        <button
                            type="button"
                            onClick={triggerRefresh}
                            disabled={loading || refreshing}
                            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition-all ${refreshing ? 'border-primary/30 bg-primary/10 text-primary shadow-[0_18px_38px_-26px_rgba(14,165,233,0.8)]' : 'border-border/70 bg-background/75 text-foreground hover:border-primary/25 hover:text-primary'}`}
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing' : 'Refresh Data'}
                        </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => scrollToSection(revenueSectionRef)}
                            className="group rounded-[26px] border border-primary/25 bg-[linear-gradient(135deg,rgba(56,189,248,0.2),rgba(99,102,241,0.14),rgba(255,255,255,0.88))] p-5 text-left shadow-[0_24px_54px_-34px_rgba(56,189,248,0.7)] transition-transform duration-300 hover:-translate-y-0.5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/80">Jump To</p>
                                    <p className="mt-3 text-xl font-extrabold tracking-tight text-foreground">Revenue</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Open the income trend, totals, and revenue window controls.</p>
                                </div>
                                <ArrowDownRight className="h-5 w-5 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1" />
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection(automationSectionRef)}
                            className="group rounded-[26px] border border-border/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(14,165,233,0.12),rgba(255,255,255,0.92))] p-5 text-left shadow-[0_24px_54px_-34px_rgba(16,185,129,0.5)] transition-transform duration-300 hover:-translate-y-0.5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Jump To</p>
                                    <p className="mt-3 text-xl font-extrabold tracking-tight text-foreground">Automation Traffic</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Go straight to delivery activity, range filters, and traffic signals.</p>
                                </div>
                                <ArrowDownRight className="h-5 w-5 shrink-0 text-emerald-600 transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1" />
                            </div>
                        </button>
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

            <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
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

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <AdminGauge
                    label="Meta Hourly Pool"
                    sublabel="200 per linked Instagram account"
                    value={metaHourlyUsage}
                    max={Math.max(metaHourlyCapacity, 1)}
                    helper={`${numberFormatter.format(metaLinkedAccounts)} linked accounts define the platform cap.`}
                    helperBelowValue={`${metaHourlyUsagePercent}% of Meta hourly capacity is currently in use.`}
                    infoDescription="This gauge measures real hourly automation usage against the Meta platform ceiling."
                    infoFormula="Numerator: sum of hourly_actions_used from all linked ig_accounts. Denominator: total linked ig_accounts × 200."
                    infoNotes={[
                        'Each linked Instagram account adds 200 hourly Meta actions to the pool.',
                        'Usage comes only from ig_accounts, not from profile rows.'
                    ]}
                />
                <AdminGauge
                    label="Hourly Limit Balance"
                    sublabel="Meta allocation vs user-plan hourly cap"
                    value={hourlyBalanceValue}
                    max={Math.max(hourlyBalanceMax, 1)}
                    helper={hourlyBalanceHelper}
                    infoDescription="This gauge shows how much hourly capacity has been sold to linked Instagram accounts compared with the Meta hourly pool."
                    infoFormula="Numerator: for each linked ig_account, sum the owning profile.hourly_action_limit. Denominator: total linked ig_accounts × 200."
                    infoNotes={[
                        'This is the oversell monitor for hourly automation capacity.',
                        'A value above the denominator means customer plan limits exceed Meta hourly allocation.'
                    ]}
                />
                <AdminGauge
                    label="User Plan Hourly Pool"
                    sublabel="Linked users' hourly consumption against allocated hourly limits"
                    value={planHourlyUsage}
                    max={Math.max(planHourlyCapacity, 1)}
                    helper={`${planHourlyUsagePercent}% of hourly profile capacity is in use.`}
                    infoDescription="This gauge shows total hourly usage against the hourly limits allocated to each linked Instagram account."
                    infoFormula="Numerator: sum of hourly_actions_used across ig_accounts. Denominator: for each linked ig_account, add the owning profile.hourly_action_limit."
                    infoNotes={[
                        'Usage is tracked per Instagram account.',
                        'Profile limits are counted once for every linked account owned by that profile.'
                    ]}
                />
                <AdminGauge
                    label="User Plan Daily Pool"
                    sublabel="Linked users' daily consumption against allocated daily limits"
                    value={planDailyUsage}
                    max={Math.max(planDailyCapacity, 1)}
                    helper={`${planDailyUsagePercent}% of daily profile capacity is in use.`}
                    infoDescription="This gauge shows total daily usage against daily limits allocated to linked Instagram accounts."
                    infoFormula="Numerator: sum of daily_actions_used across ig_accounts. Denominator: for each linked ig_account, add the owning profile.daily_action_limit."
                    infoNotes={[
                        'Daily usage is stored on ig_accounts.',
                        'Daily capacity is derived from owner profiles and counted per linked account.'
                    ]}
                />
                <AdminGauge
                    label="User Plan Monthly Pool"
                    sublabel="Linked users' monthly consumption against allocated monthly limits"
                    value={planMonthlyUsage}
                    max={Math.max(planMonthlyCapacity, 1)}
                    helper={`${planMonthlyUsagePercent}% of monthly profile capacity is in use.`}
                    infoDescription="This gauge shows total monthly usage against monthly limits allocated to linked Instagram accounts."
                    infoFormula="Numerator: sum of monthly_actions_used across ig_accounts. Denominator: for each linked ig_account, add the owning profile.monthly_action_limit."
                    infoNotes={[
                        'Monthly usage is stored on ig_accounts.',
                        'Monthly capacity is derived from owner profiles and counted per linked account.'
                    ]}
                />
            </section>

            <section className="grid grid-cols-1 gap-7">
                <section ref={revenueSectionRef} className={`${surfaceClass} ${refreshSurfaceClass} p-5 sm:p-7 xl:p-8 transition-opacity duration-300 ${refreshing ? 'opacity-85' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                                Revenue section
                            </div>
                            <h3 className="mt-4 text-[1.55rem] font-extrabold tracking-tight text-foreground">Revenue trend</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">{revenueSummaryLabel}</p>
                        </div>
                        <div className="flex w-full flex-col gap-3 lg:max-w-[320px] lg:shrink-0">
                            <button
                                type="button"
                                onClick={() => scrollToSection(automationSectionRef)}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-500/15"
                            >
                                Automation Traffic
                                <ArrowUpRight className="h-4 w-4" />
                            </button>
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
                        <div className={`order-2 h-[260px] sm:h-[320px] xl:order-1 xl:h-[340px] transition-all duration-300 ${refreshing ? 'scale-[0.995] saturate-[0.96]' : 'scale-100'}`}>
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
                                <p className="text-[10px] font-black text-muted-foreground">Top Automation</p>
                                <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{topAutomationLabel}</p>
                                <p className="mt-2 text-sm text-muted-foreground">Most active automation type in the selected traffic range.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section ref={automationSectionRef} className={`${surfaceClass} ${refreshSurfaceClass} p-5 sm:p-7 xl:p-8 transition-opacity duration-300 ${refreshing ? 'opacity-85' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                Automation section
                            </div>
                            <h3 className="mt-4 text-[1.55rem] font-extrabold tracking-tight text-foreground">Automation traffic</h3>
                            <p className="mt-1 text-[11px] font-black text-muted-foreground">Last 30 days of stored delivery activity, shown across flexible traffic windows.</p>
                        </div>
                        <div className="flex w-full flex-col gap-3 lg:max-w-[320px] lg:shrink-0">
                            <button
                                type="button"
                                onClick={() => scrollToSection(revenueSectionRef)}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/15"
                            >
                                Revenue
                                <ArrowUpRight className="h-4 w-4" />
                            </button>
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
                        <div className={`order-2 h-[260px] sm:h-[320px] xl:order-1 xl:h-[340px] transition-all duration-300 ${refreshing ? 'scale-[0.995] saturate-[0.96]' : 'scale-100'}`}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trafficChartData}>
                                    <defs>
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
                                        dataKey="successful"
                                        name="Successful"
                                        stroke={TRAFFIC_SERIES_COLORS.successful}
                                        strokeWidth={2.2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="failed"
                                        name="Failed"
                                        stroke={TRAFFIC_SERIES_COLORS.failed}
                                        strokeWidth={2.2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        name="Total events"
                                        stroke={TRAFFIC_SERIES_COLORS.total}
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 5 }}
                                        filter="url(#adminTrafficGlow)"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="rolling_average"
                                        name="Rolling avg"
                                        stroke={TRAFFIC_SERIES_COLORS.rollingAverage}
                                        strokeWidth={2}
                                        strokeDasharray="7 7"
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="order-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:order-2 xl:grid-cols-1">
                            <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
                                <p className="text-[10px] font-black text-muted-foreground">Chart Layers</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-semibold text-foreground">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: TRAFFIC_SERIES_COLORS.total }}
                                        />
                                        Total events
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-semibold text-foreground">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: TRAFFIC_SERIES_COLORS.successful }}
                                        />
                                        Successful
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-semibold text-foreground">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: TRAFFIC_SERIES_COLORS.failed }}
                                        />
                                        Failed
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-semibold text-foreground">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full border border-dashed"
                                            style={{ borderColor: TRAFFIC_SERIES_COLORS.rollingAverage }}
                                        />
                                        Rolling average
                                    </span>
                                </div>
                            </div>
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
                                <InsightTile label="Failure Share" value={`${failureShare}%`} note="Share of failed traffic in the selected range" />
                                <InsightTile
                                    label="Peak Window"
                                    value={peakTrafficPoint?.label || 'N/A'}
                                    note={peakTrafficPoint ? `${numberFormatter.format(Number(peakTrafficPoint.value || 0))} total events at peak` : 'No traffic in the selected range'}
                                />
                                <InsightTile
                                    label="Avg Successful"
                                    value={numberFormatter.format(Number(averageSuccessfulTraffic.toFixed(1)))}
                                    note={`Average successful or skipped events per ${trafficFilterMeta.bucket === 'hour' ? 'hour' : 'point'}`}
                                />
                            </div>
                        </div>
                        </div>
                    </div>
                </section>
            </section>

            <section className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                <div className="min-w-0">
                    <DonutChartCard
                        eyebrow="Automation Mix"
                        title="Automation Count by Type"
                        description="A matching frontend-style donut chart showing how your activity logs are distributed across automation types."
                        segments={automationMixSegments}
                        progress={pieProgress}
                        defaultCenterTitle="Automation Types"
                        defaultCenterValue={numberFormatter.format(automationMixSegments.length)}
                        defaultCenterCaption={`${numberFormatter.format(statusTotal)} total logs`}
                    />
                </div>
                <div className={`${surfaceClass} ${refreshSurfaceClass} p-6 sm:p-7 transition-opacity duration-300 ${refreshing ? 'opacity-85' : 'opacity-100'}`}>
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
                            <div key={item.id} className="rounded-[24px] border border-border/70 bg-background/60 px-4 py-4 sm:px-5">
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                        <p className="text-sm font-bold text-foreground">{humanizeAnalyticsLabel(item.event_type)}</p>
                                        <span className="shrink-0 text-[10px] font-black text-muted-foreground">
                                            {formatShortDate(item.sent_at || 0)}
                                        </span>
                                    </div>
                                    <p className="break-words text-sm leading-6 text-muted-foreground">{item.reason}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="space-y-7">
                <DonutChartCard
                    eyebrow="Performance Split"
                    title="Delivery Outcomes"
                    description="A matching frontend-style donut chart showing how delivery logs are split across success, failed, and skipped results."
                    segments={deliveryOutcomeSegments}
                    progress={pieProgress}
                    defaultCenterTitle="Success Rate"
                    defaultCenterValue={`${deliverySuccessRate}%`}
                    defaultCenterCaption={`${numberFormatter.format(statusTotal)} total logs`}
                />
            </section>
        </div>
    );
};

export default AnalyticsPage;
