import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import InstagramStats from '../../components/dashboard/InstagramStats';
import Gauge from '../../components/ui/gauge';
import Card from '../../components/ui/card';
import { AtSign, Check, ChevronRight, FileStack, Lightbulb as SuggestIcon, Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type CountsKey = 'reply_templates' | 'mention' | 'welcome_message' | 'suggest_more';

const COUNT_CARDS: { key: CountsKey; label: string; view: import('../../contexts/DashboardContext').ViewType; icon: React.ElementType }[] = [
  { key: 'reply_templates', label: 'Reply Templates', view: 'Reply Templates', icon: FileStack },
  { key: 'mention', label: 'Mentions', view: 'Mentions', icon: AtSign },
  { key: 'welcome_message', label: 'Welcome Message', view: 'Welcome Message', icon: Sparkles },
  { key: 'suggest_more', label: 'Suggest More', view: 'Suggest More', icon: SuggestIcon },
];

const GaugeCard = ({ label, value, max, updatedText }: { label: string; value: number; max: number; updatedText: string }) => {
  const { setCurrentView } = useDashboard();

  return (
    <Card
      variant="elevated"
      className="relative flex min-h-[208px] cursor-pointer flex-col transition-all group ig-card hover:-translate-y-0.5 hover:shadow-md lg:min-h-[236px]"
      onClick={() => setCurrentView('Analytics')}
    >
      <div className="absolute left-3.5 top-3.5 z-10 sm:left-4 sm:top-4">
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-primary">
          {label}
        </h3>
      </div>

      <div className="flex flex-1 items-center justify-center px-2 pt-6 sm:px-3 sm:pt-5">
        <Gauge
          value={value}
          max={max}
          size="lg"
          syncId="dashboard-gauges"
          updatedText={updatedText}
        />
      </div>

      <div className="absolute right-3.5 top-3.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 sm:right-4 sm:top-4">
        <ChevronRight className="h-4 w-4 text-primary" />
      </div>
    </Card>
  );
};

const DashboardOverviewView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, setCurrentView } = useDashboard();
  const [counts, setCounts] = useState<Record<CountsKey, number>>({
    reply_templates: 0,
    mention: 0,
    welcome_message: 0,
    suggest_more: 0,
  });
  const [gaugeMetrics, setGaugeMetrics] = useState({
    hourly_actions_used: 0,
    hourly_action_limit: 0,
    daily_actions_used: 0,
    daily_action_limit: 0,
    monthly_actions_used: 0,
    monthly_action_limit: 0,
  });
  const countsInFlight = useRef(false);

  useEffect(() => {
    if (countsInFlight.current) return;

    countsInFlight.current = true;
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/counts${activeAccountID ? `?account_id=${activeAccountID}` : ''}`;

    authenticatedFetch(url)
      .then((res) => (res.ok ? res.json() : {}))
      .then((payload: any) => {
        const actionWindowMetrics = payload.action_window_metrics || payload.gauge_metrics || {};
        setCounts({
          reply_templates: payload.reply_templates ?? 0,
          mention: payload.mention ?? 0,
          welcome_message: payload.welcome_message ?? 0,
          suggest_more: payload.suggest_more ?? 0,
        });
        setGaugeMetrics({
          hourly_actions_used: actionWindowMetrics.hourly_actions_used ?? 0,
          hourly_action_limit: actionWindowMetrics.hourly_action_limit ?? 0,
          daily_actions_used: actionWindowMetrics.daily_actions_used ?? 0,
          daily_action_limit: actionWindowMetrics.daily_action_limit ?? 0,
          monthly_actions_used: actionWindowMetrics.monthly_actions_used ?? 0,
          monthly_action_limit: actionWindowMetrics.monthly_action_limit ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => {
        countsInFlight.current = false;
      });
  }, [activeAccountID, authenticatedFetch]);

  const gaugeData = [
    {
      label: 'Hourly Action Usage',
      value: gaugeMetrics.hourly_actions_used,
      max: Math.max(gaugeMetrics.hourly_action_limit, 1),
      updatedText: `${gaugeMetrics.hourly_actions_used}/${Math.max(gaugeMetrics.hourly_action_limit, 1)} current hour window`
    },
    {
      label: 'Daily Action Usage',
      value: gaugeMetrics.daily_actions_used,
      max: Math.max(gaugeMetrics.daily_action_limit, 1),
      updatedText: `${gaugeMetrics.daily_actions_used}/${Math.max(gaugeMetrics.daily_action_limit, 1)} current day window`
    },
    {
      label: 'Monthly Action Usage',
      value: gaugeMetrics.monthly_actions_used,
      max: Math.max(gaugeMetrics.monthly_action_limit, 1),
      updatedText: `${gaugeMetrics.monthly_actions_used}/${Math.max(gaugeMetrics.monthly_action_limit, 1)} current month window`
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:gap-3 lg:gap-2">
      <section>
        <InstagramStats />
      </section>

      <section>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          {COUNT_CARDS.map(({ key, label, view, icon: Icon }) => {
            const count = counts[key];
            const isReplyTemplateCard = key === 'reply_templates';
            const isConfigured = count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCurrentView(view)}
                className={cn(
                  'relative flex min-h-[64px] flex-col items-start gap-1 rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-h-[70px] lg:min-h-[64px]',
                  isReplyTemplateCard
                    ? (isConfigured
                      ? 'border-border text-foreground hover:border-primary/40 hover:bg-secondary'
                      : 'border-border bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted/60')
                    : (isConfigured
                      ? 'border-emerald-200/80 bg-emerald-50/70 text-foreground hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15'
                      : 'border-rose-200/80 bg-rose-50/70 text-foreground hover:border-rose-300 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/15')
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    isReplyTemplateCard
                      ? (isConfigured ? 'text-primary' : 'text-muted-foreground')
                      : (isConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                  )}
                />
                <span className="w-full truncate text-sm font-semibold">{label}</span>
                {isReplyTemplateCard ? (
                  <span className={cn('text-base font-bold tabular-nums', isConfigured ? 'text-primary' : 'text-muted-foreground')}>{count}</span>
                ) : (
                  <span
                    className={cn(
                      'mt-auto inline-flex h-7 w-7 items-center justify-center rounded-full border',
                      isConfigured
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
                    )}
                    aria-label={isConfigured ? `${label} configured` : `${label} not configured`}
                  >
                    {isConfigured ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3">
          {gaugeData.map((gauge, index) => (
            <GaugeCard
              key={index}
              label={gauge.label}
              value={gauge.value}
              max={gauge.max}
              updatedText={gauge.updatedText}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardOverviewView;
