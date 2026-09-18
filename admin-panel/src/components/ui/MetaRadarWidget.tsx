import React from 'react';
import { ShieldCheck, AlertTriangle, Instagram, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import InfoPopover from './InfoPopover';

interface MetaRadarWidgetProps {
  metaPool?: {
    linked_accounts?: number;
    limit_per_account_per_hour?: number;
    capacity_per_hour?: number;
    usage_last_hour?: number;
    usage_percent?: number;
  };
  className?: string;
}

export const MetaRadarWidget: React.FC<MetaRadarWidgetProps> = ({ metaPool, className }) => {
  const linkedAccounts = Number(metaPool?.linked_accounts || 0);
  const limitPerAccount = Number(metaPool?.limit_per_account_per_hour || 750);
  const capacityPerHour = Number(metaPool?.capacity_per_hour || (linkedAccounts * limitPerAccount));
  const usageLastHour = Number(metaPool?.usage_last_hour || 0);
  const usagePercent = capacityPerHour > 0 ? Math.min(100, Math.round((usageLastHour / capacityPerHour) * 100)) : 0;

  const isWarning = usagePercent >= 70 && usagePercent < 85;
  const isCritical = usagePercent >= 85;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-border/70 bg-background/60 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl',
        className
      )}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-600 dark:text-pink-400">
              <Instagram className="h-3.5 w-3.5" />
              Meta 750/hr Safety Radar
            </div>
            <h3 className="mt-2 text-lg font-bold tracking-tight text-foreground">
              Instagram Account Velocity
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Anti-ban protection monitoring actions against Meta's 750 action/hour threshold.
            </p>
          </div>
          <InfoPopover
            title="Meta 750/hr Account Velocity Radar"
            description="Instagram enforces a platform rate ceiling of roughly 750 interactions (DMs, comments, story replies) per account per rolling hour. Exceeding this triggers automated action blocks or account review."
            formula="Aggregate Capacity = Linked Accounts × 750 actions/hr. Usage = Total Instagram API dispatches recorded in the last 60 minutes."
            notes={[
              'Each linked account has its own independent 750/hr ceiling.',
              'Worker nodes throttle dispatch concurrency per account to stay well below limits.',
              'Status alerts transition to Warning at 70% and Critical at 85% capacity.'
            ]}
          />
        </div>

        {/* Core Meter & Metrics */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-center">
          {/* Progress gauge visual */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {usageLastHour.toLocaleString('en-IN')}
                </span>
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  / {capacityPerHour.toLocaleString('en-IN')} actions
                </span>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold',
                  isCritical
                    ? 'bg-rose-500/15 text-rose-500'
                    : isWarning
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-emerald-500/15 text-emerald-500'
                )}
              >
                {usagePercent}% Used
              </span>
            </div>

            {/* Custom Multi-Threshold Meter */}
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-muted/60 p-0.5">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isCritical
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : isWarning
                    ? 'bg-gradient-to-r from-blue-500 to-amber-500'
                    : 'bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500'
                )}
                style={{ width: `${Math.max(2, usagePercent)}%` }}
              />
            </div>

            {/* Scale milestones */}
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>0 (Idle)</span>
              <span>250 (Moderate)</span>
              <span>500 (Elevated)</span>
              <span className="text-rose-500 font-semibold">750 (Meta Ceiling)</span>
            </div>
          </div>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/70 bg-card/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Instagram className="h-3.5 w-3.5 text-pink-500" />
                Linked IG
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {linkedAccounts.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-muted-foreground">Active IG accounts</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Max Headroom
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {Math.max(0, capacityPerHour - usageLastHour).toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-muted-foreground">Available actions/hr</p>
            </div>
          </div>
        </div>

        {/* Safety Status Callout */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border p-3.5 text-xs',
            isCritical
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : isWarning
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          )}
        >
          {isCritical ? (
            <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-rose-500" />
          ) : isWarning ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <span className="font-medium">
            {isCritical
              ? 'Critical velocity warning: Actions approaching Meta 750/hr ceiling. Streamer will prioritize throttling.'
              : isWarning
              ? 'Elevated delivery volume: Rate limiter active to prevent Instagram temporary action blocks.'
              : 'Safe operating velocity: Account dispatch velocity is well within Meta safe thresholds.'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MetaRadarWidget;
