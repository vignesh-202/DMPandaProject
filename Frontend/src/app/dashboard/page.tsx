"use client";
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, X } from 'lucide-react';
import DashboardLayout from './layout';
import DashboardLoading from '../../components/ui/DashboardLoading';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

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
const DashboardOverviewView = lazy(() => import('./DashboardOverviewView'));

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

// Dashboard Content
const DashboardContent: React.FC = () => {
  const { currentView, activeAccount, activeAccountID, isGlobalLoading, setCurrentView, accessState, hasPlanFeature } = useDashboard();

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
    return (
      <Suspense fallback={<PageLoader title="Loading Dashboard" description="Preparing your metrics..." />}>
        <DashboardOverviewView />
      </Suspense>
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
