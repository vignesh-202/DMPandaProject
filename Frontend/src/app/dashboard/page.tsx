"use client";
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import InstagramStats from '../../components/dashboard/InstagramStats';
import Gauge from '../../components/ui/gauge';
import Card from '../../components/ui/card';
import { Loader2, Lightbulb, FileStack, AtSign, Lightbulb as SuggestIcon, MailPlus, ChevronRight } from 'lucide-react';
import DashboardLayout from './layout';
import { cn } from '../../lib/utils';

type CountsKey = 'reply_templates' | 'mention' | 'suggest_more' | 'email_collector';
const COUNT_CARDS: { key: CountsKey; label: string; view: import('../../contexts/DashboardContext').ViewType; icon: React.ElementType }[] = [
  { key: 'reply_templates', label: 'Reply Templates', view: 'Reply Templates', icon: FileStack },
  { key: 'mention', label: 'Mention', view: 'Mentions', icon: AtSign },
  { key: 'suggest_more', label: 'Suggest More', view: 'Suggest More', icon: SuggestIcon },
  { key: 'email_collector', label: 'Email Collector', view: 'Email Collector', icon: MailPlus },
];

// Lazy Loaded Views
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
const AffiliateView = lazy(() => import('./AffiliateView'));
const PricingView = lazy(() => import('./PricingView'));
const MyPlanView = lazy(() => import('./MyPlanView'));
const TransactionsView = lazy(() => import('./TransactionsView'));
const ConvoStarterView = lazy(() => import('./ConvoStarterView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const ReplyTemplatesView = lazy(() => import('./ReplyTemplatesView'));
const InboxMenu = lazy(() => import('./InboxMenu'));
const StatsRow = lazy(() => import('../../components/dashboard/StatsRow'));
const PlaceholderView = lazy(() => import('./PlaceholderView'));
const SupportView = lazy(() => import('./SupportView'));
const GlobalTriggersView = lazy(() => import('./GlobalTriggersView'));
const SuperProfileView = lazy(() => import('./SuperProfileView'));

import AccountBarrier from '../../components/dashboard/AccountBarrier';

// Page Loader Component
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
    <p className="mt-4 text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
      Loading View...
    </p>
  </div>
);

// Gauge Card Component
const GaugeCard = ({ label, value, max }: { label: string; value: number; max: number }) => {
  const { setCurrentView } = useDashboard();

  return (
    <Card
      variant="elevated"
      className="relative flex flex-col aspect-[4/5] sm:aspect-square group hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => setCurrentView('Analytics')}
    >
      {/* Title */}
      <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10">
        <h3 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
          {label}
        </h3>
      </div>

      {/* Gauge - Centered */}
      <div className="flex-1 flex items-center justify-center pt-4">
        <Gauge
          value={value}
          max={max}
          size="lg"
          syncId="dashboard-gauges"
        />
      </div>

      {/* Right Arrow */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-primary" />
      </div>
    </Card>
  );
};

// Dashboard Content
const DashboardContent: React.FC = () => {
  const { currentView, activeAccount, activeAccountID, isGlobalLoading, setCurrentView } = useDashboard();
  const { authenticatedFetch } = useAuth();
  const [counts, setCounts] = useState<Record<CountsKey, number>>({
    reply_templates: 0, mention: 0, suggest_more: 0, email_collector: 0,
  });
  const countsInFlight = useRef(false);

  useEffect(() => {
    if (currentView !== 'Dashboard') return;
    if (countsInFlight.current) return;
    countsInFlight.current = true;
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/counts${activeAccountID ? `?account_id=${activeAccountID}` : ''}`;
    authenticatedFetch(url)
      .then((res) => (res.ok ? res.json() : {}))
      .then((d) => {
        setCounts({
          reply_templates: d.reply_templates ?? 0,
          mention: d.mention ?? 0,
          suggest_more: d.suggest_more ?? 0,
          email_collector: d.email_collector ?? 0,
        });
      })
      .catch(() => { })
      .finally(() => { countsInFlight.current = false; });
  }, [currentView, activeAccountID, authenticatedFetch]);

  if (isGlobalLoading) {
    return <PageLoader />;
  }

  // Protected views requiring Instagram account
  const protectedViews = [
    'Dashboard', 'DM Automation', 'Story Automation', 'Post Automation',
    'Reel Automation', 'Live Automation', 'Mentions', 'Email Collector',
    'Suggest More', 'Convo Starter', 'Global Trigger', 'Analytics', 'Reply Templates', 'Inbox Menu', 'Super Profile'
  ];

  const needsAccount = protectedViews.includes(currentView);
  const isAccountActive = activeAccount && activeAccount.status === 'active';

  if (needsAccount && (!activeAccountID || !isAccountActive)) {
    return <AccountBarrier />;
  }

  // Dashboard View
  if (currentView === 'Dashboard') {
    const gaugeData = [
      { label: 'DM Rate', value: 15, max: 100 },
      { label: 'Actions/Mo', value: 4500, max: 10000 },
      { label: 'Reel Replies', value: 72, max: 100 },
      { label: 'Post Replies', value: 85, max: 100 },
    ];

    return (
      <div className="flex flex-col gap-2 lg:gap-2.5 max-w-7xl mx-auto pb-4 lg:pb-2">
        {/* Instagram Stats Section */}
        <section>
          <InstagramStats />
        </section>

        {/* Count cards - above gauges, compact top/bottom on desktop */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {COUNT_CARDS.map(({ key, label, view, icon: Icon }) => {
              const n = counts[key];
              const disabled = n === 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 py-2.5 px-4 lg:py-2 lg:px-4 rounded-xl border text-left transition-all min-h-[72px] aspect-[2/1] sm:min-h-[76px] lg:aspect-auto lg:min-h-[70px]',
                    disabled
                      ? 'opacity-55 cursor-pointer border-border bg-muted/40 text-muted-foreground'
                      : 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-foreground'
                  )}
                >
                  <Icon className={cn('w-5 h-5 shrink-0', disabled ? 'text-muted-foreground' : 'text-primary')} />
                  <span className="text-sm font-semibold truncate w-full">{label}</span>
                  <span className={cn('text-base font-bold tabular-nums', disabled ? 'text-muted-foreground' : 'text-primary')}>{n}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Gauges Section */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-3">
            {gaugeData.map((gauge, i) => (
              <GaugeCard
                key={i}
                label={gauge.label}
                value={gauge.value}
                max={gauge.max}
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
      {currentView === 'Reply Templates' && <ReplyTemplatesView />}
      {currentView === 'Inbox Menu' && <InboxMenu />}
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
      {currentView === 'Affiliate & Referral' && <AffiliateView />}
      {currentView === 'Account Settings' && <AccountSettingsView />}
      {currentView === 'Support' && <SupportView />}
      {currentView === 'Contact' && (
        <PlaceholderView
          title="Contact Support"
          description="Our high-priority support channel is being integrated directly into your command center. For urgent inquiries, please use the public contact form or email support@dmpanda.com."
          icon={<Loader2 className="w-12 h-12 text-primary animate-spin" />}
        />
      )}
    </Suspense>
  );
};

// Main Dashboard Page
const DashboardPage = () => {
  return (
    <DashboardProvider>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </DashboardProvider>
  );
};

export default DashboardPage;
