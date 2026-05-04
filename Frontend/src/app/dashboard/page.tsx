"use client";
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import InstagramStats from '../../components/dashboard/InstagramStats';
import Gauge from '../../components/ui/gauge';
import Card from '../../components/ui/card';
import { FileStack, AtSign, Lightbulb as SuggestIcon, ChevronRight, Sparkles, Check, X, Lock } from 'lucide-react';
import DashboardLayout from './layout';
import { cn } from '../../lib/utils';
import DashboardLoading from '../../components/ui/DashboardLoading';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

type CountsKey = 'reply_templates' | 'mention' | 'welcome_message' | 'suggest_more';
const COUNT_CARDS: { key: CountsKey; label: string; view: import('../../contexts/DashboardContext').ViewType; icon: React.ElementType }[] = [
  { key: 'reply_templates', label: 'Reply Templates', view: 'Reply Templates', icon: FileStack },
  { key: 'mention', label: 'Mentions', view: 'Mentions', icon: AtSign },
  { key: 'welcome_message', label: 'Welcome Message', view: 'Welcome Message', icon: Sparkles },
  { key: 'suggest_more', label: 'Suggest More', view: 'Suggest More', icon: SuggestIcon },
];

// Lazy Loaded Views
const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  options: { retries?: number; retryDelayMs?: number } = {}
) => {
  const { retries = 1, retryDelayMs = 400 } = options;

  return lazy(async () => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        return await importer();
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs * (attempt + 1)));
        attempt += 1;
      }
    }

    throw lastError;
  });
};

const DMAutomationView = lazy(() => import('./DMAutomationView'));
const StoryAutomationView = lazy(() => import('./StoryAutomationView'));
const PostAutomationView = lazy(() => import('./PostAutomationView'));
const ReelAutomationView = lazy(() => import('./ReelAutomationView'));
const LiveAutomationView = lazy(() => import('./LiveAutomationView'));
const MentionsView = lazy(() => import('./MentionsView'));
const EmailCollectorView = lazy(() => import('./EmailCollectorView'));
const SuggestMoreView = lazy(() => import('./SuggestMoreView'));
const CommentModerationView = lazy(() => import('./CommentModerationView'));
const AccountSettingsView = lazy(() => import('./AccountSettingsView'));
const PricingView = lazy(() => import('./PricingView'));
const MyPlanView = lazy(() => import('./MyPlanView'));
const TransactionsView = lazy(() => import('./TransactionsView'));
const ConvoStarterView = lazy(() => import('./ConvoStarterView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const InsightsView = lazy(() => import('./InsightsView'));
const ReplyTemplatesView = lazy(() => import('./ReplyTemplatesView'));
const InboxMenu = lazy(() => import('./InboxMenu'));
const WelcomeMessageView = lazy(() => import('./WelcomeMessageView'));
const SupportView = lazy(() => import('./SupportView'));
const GlobalTriggersView = lazy(() => import('./GlobalTriggersView'));
const SuperProfileView = lazyWithRetry(() => import('./SuperProfileView'), { retries: 2, retryDelayMs: 500 });

import AccountBarrier from '../../components/dashboard/AccountBarrier';
import LockedFeatureModal from '../../components/ui/LockedFeatureModal';

// Page Loader Component
const PageLoader = ({ title = 'Loading view', description = 'Preparing the latest dashboard data before this section opens.' }: { title?: string; description?: string }) => (
  <LoadingOverlay
    variant="fullscreen"
    message={title}
    subMessage={description}
  />
);

// Gauge Card Component
const GaugeCard = ({ label, value, max, updatedText }: { label: string; value: number; max: number; updatedText: string }) => {
  const { setCurrentView } = useDashboard();

  return (
    <Card
      variant="elevated"
      className="relative flex min-h-[208px] flex-col group ig-card hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer lg:min-h-[236px]"
      onClick={() => setCurrentView('Analytics')}
    >
      {/* Title */}
      <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-10">
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
          {label}
        </h3>
      </div>

      {/* Gauge - Centered */}
      <div className="flex flex-1 items-center justify-center px-2 pt-6 sm:px-3 sm:pt-5">
        <Gauge
          value={value}
          max={max}
          size="lg"
          syncId="dashboard-gauges"
          updatedText={updatedText}
        />
      </div>

      {/* Right Arrow */}
      <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-primary" />
      </div>
    </Card>
  );
};

// Dashboard Content
const DashboardContent: React.FC = () => {
  const { currentView, activeAccount, activeAccountID, isGlobalLoading, setCurrentView, accessState, hasPlanFeature } = useDashboard();
  const { authenticatedFetch } = useAuth();
  const [counts, setCounts] = useState<Record<CountsKey, number>>({
    reply_templates: 0, mention: 0, welcome_message: 0, suggest_more: 0,
  });
  const [gaugeMetrics, setGaugeMetrics] = useState({
    hourly_actions_used: 0,
    hourly_action_limit: 0,
    daily_actions_used: 0,
    daily_action_limit: 0,
    monthly_actions_used: 0,
    monthly_action_limit: 0,
  });
  const [overviewReady, setOverviewReady] = useState(false);
  const countsInFlight = useRef(false);

  useEffect(() => {
    if (currentView !== 'Overview') return;
    if (countsInFlight.current) return;
    setOverviewReady(false);
    countsInFlight.current = true;
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/counts${activeAccountID ? `?account_id=${activeAccountID}` : ''}`;
    authenticatedFetch(url)
      .then((res) => (res.ok ? res.json() : {}))
      .then((d: any) => {
        const actionWindowMetrics = d.action_window_metrics || d.gauge_metrics || {};
        setCounts({
          reply_templates: d.reply_templates ?? 0,
          mention: d.mention ?? 0,
          welcome_message: d.welcome_message ?? 0,
          suggest_more: d.suggest_more ?? 0,
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
      .catch(() => { })
      .finally(() => {
        countsInFlight.current = false;
        setOverviewReady(true);
      });
  }, [currentView, activeAccountID, authenticatedFetch]);

  if (isGlobalLoading) {
    return <DashboardLoading />;
  }

  // Protected views requiring Instagram account
  const protectedViews = [
    'Overview', 'DM Automation', 'Story Automation', 'Post Automation',
    'Reel Automation', 'Live Automation', 'Mentions', 'Email Collector',
    'Welcome Message',
    'Suggest More', 'Convo Starter', 'Global Trigger', 'Analytics', 'Insights', 'Reply Templates', 'Inbox Menu', 'Super Profile'
  ];

  const needsAccount = protectedViews.includes(currentView);
  const hasSelectedAccount = Boolean(activeAccountID);
  const accountAutomationLocked = Boolean(
    activeAccount
    && (activeAccount.status !== 'active' || activeAccount?.effective_access === false)
  );
  const automationLockedViews = [
    'DM Automation', 'Story Automation', 'Post Automation', 'Reel Automation', 'Live Automation',
    'Mentions', 'Email Collector', 'Welcome Message', 'Suggest More', 'Convo Starter',
    'Global Trigger', 'Reply Templates', 'Inbox Menu', 'Super Profile', 'Comment Moderation'
  ];

  if (accessState?.automation_locked && automationLockedViews.includes(currentView)) {
    const lockTitle = accessState?.automation_lock_reason === 'kill_switch_disabled'
      ? 'Automation Processing Disabled'
      : 'Automation Access Locked';
    const lockMessage = accessState?.automation_lock_reason === 'kill_switch_disabled'
      ? 'An admin has disabled the account kill switch, so automation processing is paused for this account.'
      : (accessState?.ban_message || 'Automation access is currently restricted for this account.');
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center p-6">
        <div className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground">
            <X className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{lockTitle}</h2>
          <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {lockMessage}
          </p>
        </div>
      </div>
    );
  }

  if (needsAccount && !hasSelectedAccount) {
    return <AccountBarrier />;
  }

  if (automationLockedViews.includes(currentView) && accountAutomationLocked) {
    return <AccountBarrier />;
  }

  const viewFeatureMap: Partial<Record<typeof currentView, string>> = {
    'DM Automation': 'dm_automation',
    'Story Automation': 'story_automation',
    'Post Automation': 'post_comment_dm_reply',
    'Reel Automation': 'reel_comment_dm_reply',
    'Live Automation': 'instagram_live_automation',
    'Mentions': 'mentions',
    'Email Collector': 'collect_email',
    'Welcome Message': 'welcome_message',
    'Suggest More': 'suggest_more',
    'Convo Starter': 'convo_starters',
    'Global Trigger': 'global_trigger',
    'Inbox Menu': 'inbox_menu',
    'Super Profile': 'super_profile',
    'Comment Moderation': 'comment_moderation'
  };
  const requiredFeature = viewFeatureMap[currentView];
  if (requiredFeature && !hasPlanFeature(requiredFeature)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center p-6">
        <div className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <Lock className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-bold text-foreground">Feature locked</h2>
          <p className="mt-3 text-sm text-muted-foreground">This section is not included in your current plan.</p>
          <button onClick={() => setCurrentView('My Plan')} className="mt-6 inline-flex shrink-0 items-center justify-center rounded-2xl border border-amber-400 bg-amber-300 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-amber-950 shadow-sm transition hover:bg-amber-200">
            Upgrade Plan
          </button>
        </div>
      </div>
    );
  }

  // Dashboard View
  if (currentView === 'Overview') {
    if (!overviewReady) {
      return <PageLoader title="Loading Dashboard" description="Preparing your metrics..." />;
    }

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
        {/* Instagram Stats Section */}
        <section>
          <InstagramStats />
        </section>

        {/* Count cards - above gauges, compact top/bottom on desktop */}
        <section>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
            {COUNT_CARDS.map(({ key, label, view, icon: Icon }) => {
              const n = counts[key];
              const isReplyTemplateCard = key === 'reply_templates';
              const isConfigured = n > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  className={cn(
                    'relative flex min-h-[64px] flex-col items-start gap-1 px-3.5 py-2.5 rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-h-[70px] lg:min-h-[64px]',
                    isReplyTemplateCard
                      ? (isConfigured
                        ? 'border-border hover:border-primary/40 hover:bg-secondary text-foreground'
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
                    <span className={cn('text-base font-bold tabular-nums', isConfigured ? 'text-primary' : 'text-muted-foreground')}>{n}</span>
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

        {/* Gauges Section */}
        <section>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 sm:gap-3">
            {gaugeData.map((gauge, i) => (
              <GaugeCard
                key={i}
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
  }

  // Other Views
  return (
    <Suspense fallback={<PageLoader />}>
      {currentView === 'Analytics' && <AnalyticsView />}
      {currentView === 'Insights' && <InsightsView />}
      {currentView === 'Reply Templates' && <ReplyTemplatesView />}
      {currentView === 'Inbox Menu' && <InboxMenu />}
      {currentView === 'Welcome Message' && <WelcomeMessageView />}
      {currentView === 'Super Profile' && <SuperProfileView />}
      {currentView === 'Convo Starter' && <ConvoStarterView />}
      {currentView === 'Global Trigger' && <GlobalTriggersView />}
      {currentView === 'DM Automation' && <DMAutomationView />}
      {currentView === 'Post Automation' && <PostAutomationView />}
      {currentView === 'Reel Automation' && <ReelAutomationView />}
      {currentView === 'Story Automation' && <StoryAutomationView />}
      {currentView === 'Live Automation' && <LiveAutomationView />}
      {currentView === 'Mentions' && <MentionsView />}
      {currentView === 'Email Collector' && <EmailCollectorView />}
      {currentView === 'Suggest More' && <SuggestMoreView />}
      {currentView === 'Comment Moderation' && <CommentModerationView />}
      {currentView === 'My Plan' && <MyPlanView />}
      {currentView === 'Transactions' && <TransactionsView />}
      {currentView === 'Account Settings' && <AccountSettingsView />}
      {currentView === 'Support' && <SupportView />}
      {currentView === 'Contact' && <SupportView mode="contact" />}
    </Suspense>
  );
};

// Main Dashboard Page
const DashboardPage = () => {
  const { authenticatedFetch, accessState, user } = useAuth();
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');
  const [lockedMessage, setLockedMessage] = useState('');
  const [showSoftBanPopup, setShowSoftBanPopup] = useState(false);
  const softBanPopupKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ featureName?: string; message?: string }>;
      setLockedFeatureName(customEvent.detail?.featureName || 'Automation');
      setLockedMessage(customEvent.detail?.message || '');
      setIsLockedModalOpen(true);
    };
    window.addEventListener('show-locked-feature-modal', handler as EventListener);
    return () => window.removeEventListener('show-locked-feature-modal', handler as EventListener);
  }, []);

  useEffect(() => {
    const popupKey = `${user?.$id || 'guest'}:${accessState?.ban_mode || 'none'}:${accessState?.ban_message || ''}`;
    if (accessState?.is_soft_banned && softBanPopupKeyRef.current !== popupKey) {
      softBanPopupKeyRef.current = popupKey;
      setShowSoftBanPopup(true);
    }
  }, [accessState?.ban_message, accessState?.ban_mode, accessState?.is_soft_banned, user?.$id]);

  const handleInstagramLink = async () => {
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/instagram/url`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to get Instagram login URL:', data.error);
      }
    } catch (err) {
      console.error('Failed to start Instagram login:', err);
    }
  };

  return (
    <DashboardProvider>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
      <LockedFeatureModal
        isOpen={isLockedModalOpen}
        onClose={() => setIsLockedModalOpen(false)}
        onConnect={handleInstagramLink}
        featureName={lockedMessage || lockedFeatureName}
      />
      {showSoftBanPopup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Soft Ban Active</p>
                <h2 className="mt-2 text-2xl font-bold text-foreground">Your account is under a soft ban</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSoftBanPopup(false)}
                className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close account notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 break-words whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {accessState?.ban_message || 'An admin has placed this account under a soft ban. You can still open the dashboard, but automation actions are paused until the soft ban is removed.'}
            </p>
          </div>
        </div>
      )}
    </DashboardProvider>
  );
};

export default DashboardPage;
