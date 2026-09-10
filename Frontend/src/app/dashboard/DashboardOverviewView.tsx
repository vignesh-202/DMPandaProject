import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import InstagramStats from '../../components/dashboard/InstagramStats';
import Gauge, { getGaugeLevelStyle } from '../../components/ui/gauge';
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

const GaugeCard = ({
  label,
  value,
  max,
  allocated,
  remained,
  updatedText,
}: {
  label: string;
  value: number;
  max: number;
  allocated: number;
  remained: number;
  updatedText: string;
}) => {
  const { setCurrentView } = useDashboard();
  const isUnlimited = allocated <= 0;
  const remainingStyle = getGaugeLevelStyle(value, isUnlimited ? 0 : max);

  return (
    <Card
      variant="elevated"
      className="relative flex min-h-[220px] cursor-pointer flex-col justify-between p-4 sm:p-5 transition-all group hover:-translate-y-0.5 hover:shadow-sm border border-border/80 rounded-2xl lg:min-h-[250px]"
      onClick={() => setCurrentView('Analytics')}
    >
      <div className="flex items-start justify-between w-full">
        <h3 className="text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
          {label}
        </h3>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        <Gauge
          value={value}
          max={isUnlimited ? 0 : max}
          size="lg"
          syncId="dashboard-gauges"
          updatedText={isUnlimited ? 'Unlimited actions' : updatedText}
          isUnlimited={isUnlimited}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5 text-center text-xs">
        <div
          className={cn(
            "rounded-xl px-2.5 py-1.5 transition-all border",
            remainingStyle.bgClass,
            remainingStyle.borderClass
          )}
          style={{
            backgroundColor: `${remainingStyle.color}14`,
            borderColor: `${remainingStyle.color}35`,
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: remainingStyle.color }}
          >
            Remaining
          </p>
          <p className="text-sm font-bold text-foreground">{isUnlimited ? 'Unlimited' : remained.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-primary/10 px-2.5 py-1.5 border border-primary/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Allocated</p>
          <p className="text-sm font-bold text-foreground">{isUnlimited ? 'Unlimited' : allocated.toLocaleString()}</p>
        </div>
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
    allocated_hourly_credits: 0,
    remained_hourly_credits: 0,
    allocated_daily_credits: 0,
    remained_daily_credits: 0,
    allocated_monthly_credits: 0,
    remained_monthly_credits: 0,
  });
  const countsInFlight = useRef(false);

  useEffect(() => {
    if (countsInFlight.current) return;

    countsInFlight.current = true;
    const url = `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/dashboard/counts${activeAccountID ? `?account_id=${activeAccountID}` : ''}`;

    authenticatedFetch(url)
      .then((res) => (res.ok ? res.json() : {}))
      .then((payload: any) => {
        const actionWindowMetrics = payload.action_window_metrics || payload.gauge_metrics || {};
        const hourlyLimit = actionWindowMetrics.allocated_hourly_credits ?? actionWindowMetrics.hourly_action_limit ?? 0;
        const dailyLimit = actionWindowMetrics.allocated_daily_credits ?? actionWindowMetrics.daily_action_limit ?? 0;
        const monthlyLimit = actionWindowMetrics.allocated_monthly_credits ?? actionWindowMetrics.monthly_action_limit ?? 0;

        const hourlyUsed = actionWindowMetrics.hourly_actions_used ?? 0;
        const dailyUsed = actionWindowMetrics.daily_actions_used ?? 0;
        const monthlyUsed = actionWindowMetrics.monthly_actions_used ?? 0;

        setCounts({
          reply_templates: payload.reply_templates ?? 0,
          mention: payload.mention ?? 0,
          welcome_message: payload.welcome_message ?? 0,
          suggest_more: payload.suggest_more ?? 0,
        });
        setGaugeMetrics({
          hourly_actions_used: hourlyUsed,
          hourly_action_limit: hourlyLimit,
          daily_actions_used: dailyUsed,
          daily_action_limit: dailyLimit,
          monthly_actions_used: monthlyUsed,
          monthly_action_limit: monthlyLimit,
          allocated_hourly_credits: hourlyLimit,
          remained_hourly_credits: Math.max(0, hourlyLimit - hourlyUsed),
          allocated_daily_credits: dailyLimit,
          remained_daily_credits: Math.max(0, dailyLimit - dailyUsed),
          allocated_monthly_credits: monthlyLimit,
          remained_monthly_credits: Math.max(0, monthlyLimit - monthlyUsed),
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
      max: (gaugeMetrics.allocated_hourly_credits ?? gaugeMetrics.hourly_action_limit ?? 0) <= 0
        ? 0
        : Math.max(gaugeMetrics.allocated_hourly_credits ?? gaugeMetrics.hourly_action_limit, 1),
      allocated: gaugeMetrics.allocated_hourly_credits ?? gaugeMetrics.hourly_action_limit ?? 0,
      remained: gaugeMetrics.remained_hourly_credits,
      updatedText: (gaugeMetrics.allocated_hourly_credits ?? gaugeMetrics.hourly_action_limit ?? 0) <= 0
        ? 'Unlimited actions'
        : `out of ${(gaugeMetrics.allocated_hourly_credits ?? gaugeMetrics.hourly_action_limit ?? 0).toLocaleString()}`
    },
    {
      label: 'Daily Action Usage',
      value: gaugeMetrics.daily_actions_used,
      max: (gaugeMetrics.allocated_daily_credits ?? gaugeMetrics.daily_action_limit ?? 0) <= 0
        ? 0
        : Math.max(gaugeMetrics.allocated_daily_credits ?? gaugeMetrics.daily_action_limit, 1),
      allocated: gaugeMetrics.allocated_daily_credits ?? gaugeMetrics.daily_action_limit ?? 0,
      remained: gaugeMetrics.remained_daily_credits,
      updatedText: (gaugeMetrics.allocated_daily_credits ?? gaugeMetrics.daily_action_limit ?? 0) <= 0
        ? 'Unlimited actions'
        : `out of ${(gaugeMetrics.allocated_daily_credits ?? gaugeMetrics.daily_action_limit ?? 0).toLocaleString()}`
    },
    {
      label: 'Monthly Action Usage',
      value: gaugeMetrics.monthly_actions_used,
      max: (gaugeMetrics.allocated_monthly_credits ?? gaugeMetrics.monthly_action_limit ?? 0) <= 0
        ? 0
        : Math.max(gaugeMetrics.allocated_monthly_credits ?? gaugeMetrics.monthly_action_limit, 1),
      allocated: gaugeMetrics.allocated_monthly_credits ?? gaugeMetrics.monthly_action_limit ?? 0,
      remained: gaugeMetrics.remained_monthly_credits,
      updatedText: (gaugeMetrics.allocated_monthly_credits ?? gaugeMetrics.monthly_action_limit ?? 0) <= 0
        ? 'Unlimited actions'
        : `out of ${(gaugeMetrics.allocated_monthly_credits ?? gaugeMetrics.monthly_action_limit ?? 0).toLocaleString()}`
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6 lg:gap-8">
      <section>
        <InstagramStats />
      </section>

      <section>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          {COUNT_CARDS.map(({ key, label, view, icon: Icon }) => {
            const count = counts[key];
            const isReplyTemplateCard = key === 'reply_templates';
            const isConfigured = count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCurrentView(view)}
                className="relative flex min-h-[82px] flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm group"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="h-4 w-4" />
                  </div>
                  {isReplyTemplateCard ? (
                    <span className="text-base font-bold text-foreground tabular-nums">{count}</span>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
                        isConfigured
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-border/60 bg-muted/50 text-muted-foreground'
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', isConfigured ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                      {isConfigured ? 'Active' : 'Off'}
                    </span>
                  )}
                </div>
                <div className="mt-2.5">
                  <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {isReplyTemplateCard ? 'Saved templates' : (isConfigured ? 'Automation configured' : 'Click to setup')}
                  </p>
                </div>
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
              allocated={gauge.allocated}
              remained={gauge.remained}
              updatedText={gauge.updatedText}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardOverviewView;

