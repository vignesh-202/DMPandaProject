import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Eye,
  ImageIcon,
  Link2,
  Users
} from 'lucide-react';
import Card from '../../components/ui/card';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';

type InsightValue = {
  label?: string;
  value?: number;
  period?: string;
};

type InsightSeries = {
  label?: string;
  period?: string;
  series?: Array<{ end_time?: string | null; value?: number | null }>;
};

type InsightsPayload = {
  account?: {
    username?: string;
    name?: string;
    profile_picture_url?: string;
    access_state?: string;
  };
  period?: string;
  summary?: {
    followers?: number;
    following?: number;
    media_count?: number;
    username?: string;
    name?: string;
    biography?: string;
    website?: string;
    profile_picture_url?: string;
  };
  account_metrics?: Record<string, InsightValue>;
  account_timeseries?: Record<string, InsightSeries>;
  audience?: Record<string, Record<string, number>>;
  unsupported_metrics?: string[];
  insights_available?: boolean;
};

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'days_28', label: '28 days' }
] as const;

const numberFormatter = new Intl.NumberFormat('en-IN');

const formatNumber = (value: number | null | undefined) => numberFormatter.format(Number(value || 0));

const formatMetricLabel = (value: string) => String(value || '')
  .split('_')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const formatSeriesDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const buildChartPoints = (
  series: Array<{ value?: number | null }>,
  width: number,
  height: number,
  padding: number
) => {
  const values = series.map((entry) => Number(entry?.value || 0));
  const max = Math.max(...values, 1);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);

  return values.map((value, index) => {
    const x = padding + ((usableWidth * index) / Math.max(values.length - 1, 1));
    const y = height - padding - ((value / max) * usableHeight);
    return { x, y, value };
  });
};

const buildLinePath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

const buildAreaPath = (points: Array<{ x: number; y: number }>, height: number, padding: number) => {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${buildLinePath(points)} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;
};

const InlineSparkline = ({ series }: { series: Array<{ value?: number | null }> }) => {
  const width = 120;
  const height = 42;
  const padding = 4;
  const points = useMemo(() => buildChartPoints(series, width, height, padding), [series]);
  const linePath = useMemo(() => buildLinePath(points), [points]);
  const areaPath = useMemo(() => buildAreaPath(points, height, padding), [points]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full max-w-[120px]" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="insightsSparkArea" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(64,93,230,0.35)" />
          <stop offset="100%" stopColor="rgba(64,93,230,0.02)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#insightsSparkArea)" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" strokeLinecap="round" />
    </svg>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  note,
  series
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note: string;
  series?: Array<{ value?: number | null }>;
}) => (
  <Card variant="instagram" className="border border-content shadow-sm">
    <div className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
        {series && series.length > 1 ? (
          <div className="mt-4 flex items-end justify-between gap-3">
            <InlineSparkline series={series} />
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Trend
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

const TrendChart = ({ series }: { series: Array<{ end_time?: string | null; value?: number | null }> }) => {
  const width = 420;
  const height = 180;
  const padding = 18;
  const points = useMemo(() => buildChartPoints(series, width, height, padding), [series]);
  const linePath = useMemo(() => buildLinePath(points), [points]);
  const areaPath = useMemo(() => buildAreaPath(points, height, padding), [points]);
  const recentLabels = series.filter((_, index) => index === 0 || index === series.length - 1 || index === Math.floor((series.length - 1) / 2));

  return (
    <div className="rounded-[24px] border border-border bg-gradient-to-br from-primary/[0.06] via-background to-background p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="insightsArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(64,93,230,0.30)" />
            <stop offset="100%" stopColor="rgba(64,93,230,0.02)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            x2={width - padding}
            y1={padding + (height - padding * 2) * ratio}
            y2={padding + (height - padding * 2) * ratio}
            stroke="currentColor"
            strokeOpacity="0.08"
            className="text-foreground"
          />
        ))}
        <path d={areaPath} fill="url(#insightsArea)" />
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="4" className="text-primary" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle key={`${index}-${point.value}`} cx={point.x} cy={point.y} r="4.5" fill="white" stroke="currentColor" strokeWidth="3" className="text-primary" />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {recentLabels.map((point, index) => (
          <span key={`${point.end_time || index}-${index}`} className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
            {formatSeriesDate(point.end_time)} {formatNumber(point.value)}
          </span>
        ))}
      </div>
    </div>
  );
};

const AudienceBars = ({ audience }: { audience: Record<string, number> }) => {
  const rows = Object.entries(audience)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([hour, value]) => ({ hour, value: Number(value || 0) }));
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="mt-5 space-y-3">
      {rows.map((row) => (
        <div key={row.hour} className="rounded-2xl border border-border bg-background/60 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-foreground">{row.hour}:00</p>
            <p className="text-sm font-black text-foreground">{formatNumber(row.value)}</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-400"
              style={{ width: `${Math.max(8, Math.round((row.value / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const InsightsView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, activeAccount } = useDashboard();
  const [payload, setPayload] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]['value']>('days_28');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeAccountID) {
        setPayload(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await authenticatedFetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/instagram/insights?account_id=${encodeURIComponent(activeAccountID)}&period=${encodeURIComponent(period)}`
        );
        const data = await response.json().catch(() => null);
        if (!cancelled) {
          setPayload(response.ok ? data : null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeAccountID, authenticatedFetch, period]);

  const summary = payload?.summary || {};
  const accountMetrics = payload?.account_metrics || {};
  const timeseries = payload?.account_timeseries || {};
  const audience = payload?.audience || {};

  const profilePicture = toBrowserPreviewUrl(summary.profile_picture_url || activeAccount?.profile_picture_url || '');
  const topCards = [
    { label: 'Followers', value: formatNumber(summary.followers), note: 'Current account follower count', icon: Users, series: timeseries.follower_count?.series || [] },
    { label: 'Reach', value: formatNumber(accountMetrics.reach?.value), note: 'Accounts reached in the selected period', icon: Eye, series: timeseries.reach?.series || [] },
    { label: 'Views', value: formatNumber(accountMetrics.views?.value), note: 'View count returned by Instagram', icon: Activity, series: timeseries.views?.series || [] },
    { label: 'Engaged', value: formatNumber(accountMetrics.accounts_engaged?.value), note: 'Accounts engaged in the selected period', icon: BarChart3, series: timeseries.accounts_engaged?.series || [] },
    { label: 'Profile Taps', value: formatNumber(accountMetrics.profile_links_taps?.value), note: 'Profile link taps returned by Instagram', icon: Link2, series: timeseries.profile_links_taps?.series || [] },
    { label: 'Media', value: formatNumber(summary.media_count), note: 'Published media on this account', icon: ImageIcon, series: [] }
  ];

  if (loading) {
    return <LoadingOverlay variant="fullscreen" message="Loading insights" subMessage="Fetching account and audience insight data..." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="rounded-[30px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(64,93,230,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,96,64,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,rgba(64,93,230,0.20),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,96,64,0.16),transparent_24%),linear-gradient(135deg,rgba(23,23,23,0.98),rgba(10,10,10,0.96))] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            {profilePicture ? (
              <img src={profilePicture} alt={summary.username || activeAccount?.username || 'Instagram account'} className="h-16 w-16 rounded-full border-2 border-white/70 object-cover shadow-lg dark:border-white/10" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <div>
              <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Instagram Insights
              </div>
              <h2 className="mt-3 text-2xl font-bold text-foreground">{summary.username || activeAccount?.username || 'Insights'}</h2>
              <p className="text-sm text-muted-foreground">{summary.name || activeAccount?.name || 'Instagram Business account'}</p>
              {summary.biography ? (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{summary.biography}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">{formatNumber(summary.followers)} followers</span>
                <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">{formatNumber(summary.following)} following</span>
                <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">{formatNumber(summary.media_count)} media</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="inline-flex rounded-2xl bg-muted p-1">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${period === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {summary.website ? (
              <a href={summary.website} target="_blank" rel="noreferrer" className="block text-sm font-medium text-primary underline-offset-4 hover:underline">
                {summary.website}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {topCards.map(({ label, value, note, icon, series }) => (
          <MetricCard key={label} icon={icon} label={label} value={value} note={note} series={series} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card variant="instagram" className="border border-content shadow-sm">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-foreground">Account trends</h3>
                <p className="mt-1 text-sm text-muted-foreground">Returned metrics for the selected period.</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {PERIOD_OPTIONS.find((item) => item.value === period)?.label || '28 days'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Object.entries(timeseries).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground lg:col-span-2">
                  Instagram did not return time-series data for this account and period.
                </div>
              ) : Object.entries(timeseries).map(([key, entry]) => (
                <div key={key} className="rounded-[24px] border border-border bg-background/60 p-4 shadow-sm">
                  {(() => {
                    const trendSeries = entry.series || [];
                    const latestPoint = trendSeries.length > 0 ? trendSeries[trendSeries.length - 1] : null;
                    const peakValue = Math.max(...trendSeries.map((point) => Number(point.value || 0)), 0);
                    return (
                      <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{entry.label || formatMetricLabel(key)}</p>
                      <p className="mt-2 text-2xl font-black text-foreground">
                        {formatNumber(entry.series?.[0]?.value || accountMetrics[key]?.value || 0)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{entry.period || period}</p>
                  </div>
                  <div className="mt-4">
                    <TrendChart series={entry.series || []} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-muted/60 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Latest</p>
                      <p className="mt-2 text-lg font-black text-foreground">{formatNumber(latestPoint?.value)}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/60 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Peak</p>
                      <p className="mt-2 text-lg font-black text-foreground">{formatNumber(peakValue)}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/60 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Points</p>
                      <p className="mt-2 text-lg font-black text-foreground">{formatNumber(trendSeries.length)}</p>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card variant="instagram" className="border border-content shadow-sm">
          <div className="p-5 sm:p-6">
            <h3 className="text-xl font-bold text-foreground">Audience availability</h3>
            <p className="mt-1 text-sm text-muted-foreground">Audience-specific metrics only appear when Instagram returns them.</p>

            {audience.online_followers && Object.keys(audience.online_followers).length > 0 ? (
              <AudienceBars audience={audience.online_followers} />
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Audience metrics are unavailable for this account right now. Instagram can return empty audience datasets, especially when account eligibility or follower thresholds are not met.
              </div>
            )}

            {payload?.unsupported_metrics && payload.unsupported_metrics.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Unsupported or unavailable metrics</p>
                    <p className="mt-1">
                      {payload.unsupported_metrics.map((item) => formatMetricLabel(item)).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {!payload?.insights_available && (
        <Card className="border border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex gap-3 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
            <div>
              <h3 className="font-bold text-foreground">Instagram returned limited insight data</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                DM Panda is still showing account data where available, but some insight metrics can be missing because of Instagram eligibility rules, follower thresholds, or data freshness delays.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default InsightsView;
