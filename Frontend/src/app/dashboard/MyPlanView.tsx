import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Info,
  Instagram,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Zap,
  Gift
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useNotification } from '../../contexts/NotificationContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import InfoPopover from '../../components/ui/InfoPopover';
import VVDealsOfferBanner from '../../components/ui/VVDealsOfferBanner';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import {
  PricingPlan,
  buildPlanLimitItems,
  formatMoney,
  getPaidCheckoutPlans,
  getPlanBigPrice,
  getPlanBilledTotal,
  normalizePricingPayload,
  pricingPlanMatchesIdentifier
} from '../../lib/pricing';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';
import PlanCheckoutModal from '../../components/dashboard/PlanCheckoutModal';
import { cn } from '../../lib/utils';

export type AccountPlanDetail = {
  account_id: string;
  username: string;
  profile_picture_url: string | null;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  subscription_status: string;
  expires_at: string | null;
  plan_price: number;
  paid_at: string | null;
  is_active: boolean;
  is_expired: boolean;
  limits?: {
    hourly_action_limit?: number;
    daily_action_limit?: number;
    monthly_action_limit?: number;
  };
  details?: {
    name: string;
    features: string[];
    price_monthly_inr: number;
  };
};

export type UserPlan = {
  plan_id: string;
  plan_code: string;
  assigned_plan_id?: string;
  plan_source?: string | null;
  expiry_date: string | null;
  is_active: boolean;
  is_expired: boolean;
  billing_cycle?: string;
  access_state?: {
    automation_locked?: boolean;
    ban_message?: string | null;
  } | null;
  details: {
    name: string;
    features: string[];
    price_monthly_inr: number;
    price_yearly_inr?: number;
    price_yearly_monthly_inr?: number;
    yearly_bonus?: string;
  } | null;
  limits?: {
    hourly_action_limit?: number;
    daily_action_limit?: number;
    monthly_action_limit?: number;
    instagram_connections_limit?: number;
  };
  active_account_plan?: AccountPlanDetail | null;
  other_accounts_plans?: AccountPlanDetail[];
  all_accounts_plans?: AccountPlanDetail[];
};

const MyPlanView: React.FC = () => {
  const { authenticatedFetch, checkAuth } = useAuth();
  const {
    igAccounts,
    activeAccountID,
    setActiveAccountID,
    setCurrentView,
    isInitialLoadComplete,
    fetchIgAccounts,
    planPureLimits
  } = useDashboard();

  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const currency = 'INR';
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Modal checkout states
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCheckoutPlanId, setSelectedCheckoutPlanId] = useState<string | null>(null);
  const [targetCheckoutAccountId, setTargetCheckoutAccountId] = useState<string | null>(null);

  // Success banner
  const [upgradeSuccessMessage, setUpgradeSuccessMessage] = useState<string | null>(null);
  const { showSuccess } = useNotification();

  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);

  const fetchMyPlan = React.useCallback(
    async (targetAccountId?: string | null) => {
      const accountId = targetAccountId !== undefined ? targetAccountId : activeAccountID;
      const queryParam = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
      try {
        const response = await authenticatedFetch(
          `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/my-plan${queryParam}`,
          {
            headers: {
              ...pricingHeaders,
              ...(accountId ? { 'x-account-id': accountId } : {})
            }
          }
        );
        if (!response.ok) {
          setPlan(null);
          setPlanError('We could not confirm your latest plan details. Please try again.');
          return;
        }
        const data = await response.json().catch(() => null);
        setPlan(data);
        setPlanError(null);
      } catch (err) {
        console.error('Failed to fetch plan details:', err);
        setPlanError('We could not confirm your latest plan details. Please try again.');
      }
    },
    [authenticatedFetch, pricingHeaders, activeAccountID]
  );

  const fetchPlans = React.useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const response = await authenticatedFetch(
        `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`,
        {
          headers: pricingHeaders
        }
      );
      const data = await response.json().catch(() => ({}));
      const normalized = normalizePricingPayload(data);
      setPlans(normalized);
      if (normalized.length === 0) {
        setPlansError('No plans are available right now.');
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      setPlans([]);
      setPlansError('Could not load plans. Please try again.');
    } finally {
      setPlansLoading(false);
    }
  }, [authenticatedFetch, pricingHeaders]);

  useEffect(() => {
    const init = async () => {
      try {
        const geo = await detectGeoCurrency();
        setCountryCode(geo.countryCode);
        const headers = buildCountryHeaders(geo.countryCode);
        const queryParam = activeAccountID ? `?account_id=${encodeURIComponent(activeAccountID)}` : '';
        const [planResponse, pricingResponse] = await Promise.all([
          authenticatedFetch(
            `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/my-plan${queryParam}`,
            {
              headers: {
                ...headers,
                ...(activeAccountID ? { 'x-account-id': activeAccountID } : {})
              }
            }
          ),
          authenticatedFetch(
            `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`,
            { headers }
          )
        ]);
        const planData = await planResponse.json().catch(() => null);
        const pricingData = await pricingResponse.json().catch(() => ({}));
        setPlan(planResponse.ok ? planData : null);
        setPlanError(planResponse.ok ? null : 'We could not confirm your latest plan details. Please try again.');
        setPlans(normalizePricingPayload(pricingData));
      } catch (error) {
        console.error('Failed to initialize my plan view:', error);
        setPlanError('We could not confirm your latest plan details. Please try again.');
      } finally {
        setLoading(false);
        setPlansLoading(false);
      }
    };
    void init();
  }, [authenticatedFetch, activeAccountID]);

  // Re-fetch my-plan whenever activeAccountID changes
  useEffect(() => {
    if (!loading && isInitialLoadComplete) {
      void fetchMyPlan(activeAccountID);
    }
  }, [activeAccountID, fetchMyPlan, isInitialLoadComplete, loading]);

  const currentPlanName = String(
    plan?.active_account_plan?.plan_name || plan?.details?.name || 'Free Plan'
  );

  const formattedExpiryDate = useMemo(() => {
    const expiry = plan?.active_account_plan?.expires_at || plan?.expiry_date;
    if (!expiry) return null;
    const parsed = new Date(expiry);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [plan?.active_account_plan?.expires_at, plan?.expiry_date]);

  const expiryDaysRemaining = useMemo(() => {
    const expiry = plan?.active_account_plan?.expires_at || plan?.expiry_date;
    if (!expiry) return null;
    const parsed = new Date(expiry);
    if (Number.isNaN(parsed.getTime())) return null;
    const diffDays = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [plan?.active_account_plan?.expires_at, plan?.expiry_date]);

  const planCode = plan?.active_account_plan?.plan_code || plan?.plan_code || 'free';
  const isTemporaryFree = planCode === 'free' && Boolean(formattedExpiryDate);
  const isPermanentFree = planCode === 'free' && !formattedExpiryDate;
  const isExpired = Boolean(plan?.active_account_plan?.is_expired ?? plan?.is_expired);
  const isActive = Boolean(plan?.active_account_plan?.is_active ?? plan?.is_active);

  const statusBadge = useMemo(() => {
    if (isExpired) {
      return {
        label: 'Expired',
        bg: 'bg-destructive/10 text-destructive border-destructive/20',
        dot: 'bg-destructive animate-pulse'
      };
    }
    if (isTemporaryFree) {
      return {
        label: 'Temporary Free',
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500'
      };
    }
    if (isPermanentFree) {
      return {
        label: 'Free Plan',
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dot: 'bg-blue-500'
      };
    }
    if (isActive) {
      return {
        label: 'Active Subscription',
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500 animate-pulse'
      };
    }
    return {
      label: 'Inactive',
      bg: 'bg-muted text-muted-foreground border-border',
      dot: 'bg-muted-foreground'
    };
  }, [isActive, isExpired, isPermanentFree, isTemporaryFree]);

  const checkoutPlans = useMemo(() => {
    return getPaidCheckoutPlans(plans, plan?.plan_id, currentPlanName);
  }, [plans, plan?.plan_id, currentPlanName]);

  const isCurrentPricingPlan = React.useCallback(
    (entry: PricingPlan) => {
      return (
        pricingPlanMatchesIdentifier(entry, plan?.plan_id) ||
        pricingPlanMatchesIdentifier(entry, plan?.plan_code) ||
        pricingPlanMatchesIdentifier(entry, currentPlanName)
      );
    },
    [currentPlanName, plan?.plan_code, plan?.plan_id]
  );

  // Open checkout for general upgrade or specific plan
  const openCheckout = (selectedPlan?: PricingPlan, targetAccountId?: string | null) => {
    setSelectedCheckoutPlanId(selectedPlan?.id || checkoutPlans[0]?.id || null);
    setTargetCheckoutAccountId(targetAccountId || null);
    setCheckoutOpen(true);
  };

  // Open checkout targeting a specific IG account
  const openAccountUpgrade = (accountId: string, preselectedPlanId?: string) => {
    setTargetCheckoutAccountId(accountId);
    if (preselectedPlanId) {
      setSelectedCheckoutPlanId(preselectedPlanId);
    } else {
      // Find the account's current plan rank
      const targetAccount = allAccounts.find((a: any) => a.account_id === accountId);
      const rawCode = String(targetAccount?.plan_code || 'free').toLowerCase();
      let currentRank = 0;
      if (rawCode === 'basic') currentRank = 1;
      else if (rawCode === 'pro') currentRank = 2;
      else if (rawCode === 'ultra') currentRank = 3;

      if (targetAccount?.expires_at && new Date(targetAccount.expires_at).getTime() <= Date.now()) {
        currentRank = 0;
      }

      const nextHigherPlan = checkoutPlans.find((p) => {
        const pCode = String(p.plan_code || p.id).toLowerCase();
        let pRank = 0;
        if (pCode.includes('basic')) pRank = 1;
        else if (pCode.includes('pro')) pRank = 2;
        else if (pCode.includes('ultra')) pRank = 3;
        return pRank > currentRank;
      });

      setSelectedCheckoutPlanId(nextHigherPlan?.id || checkoutPlans[0]?.id || null);
    }
    setCheckoutOpen(true);
  };

  const refreshAfterPayment = async () => {
    setSyncingPlan(true);
    try {
      await Promise.all([
        fetchMyPlan(activeAccountID),
        fetchPlans(),
        checkAuth(),
        fetchIgAccounts?.()
      ]);
    } finally {
      setSyncingPlan(false);
      setPaymentLoading(null);
    }
  };

  const handleSelectAccount = (accId: string) => {
    setActiveAccountID(accId);
    void fetchMyPlan(accId);
  };

  const allAccounts = useMemo(() => {
    return plan?.all_accounts_plans || [];
  }, [plan?.all_accounts_plans]);

  const checkoutIgAccounts = useMemo(() => {
    const accountPlanMap = new Map<string, any>();
    (plan?.all_accounts_plans || []).forEach((acc: any) => {
      if (acc.account_id) accountPlanMap.set(String(acc.account_id), acc);
      if (acc.id) accountPlanMap.set(String(acc.id), acc);
    });

    if (Array.isArray(igAccounts) && igAccounts.length > 0) {
      return igAccounts.map((account) => {
        const planInfo = accountPlanMap.get(String(account.id)) || accountPlanMap.get(String(account.ig_user_id)) || null;
        return {
          ...account,
          plan_code: planInfo?.plan_code || account.plan_code || 'free',
          plan_name: planInfo?.plan_name || account.plan_name || 'Free Plan',
          expires_at: planInfo?.expires_at || account.expires_at || null,
          subscription_status: planInfo?.subscription_status || account.subscription_status || 'active',
          is_active: planInfo?.is_active ?? account.is_active ?? true
        };
      });
    }

    return (plan?.all_accounts_plans || []).map((acc: any) => ({
      id: acc.account_id,
      ig_user_id: acc.account_id,
      username: acc.username,
      name: acc.username,
      profile_picture_url: acc.profile_picture_url,
      plan_code: acc.plan_code,
      plan_name: acc.plan_name,
      expires_at: acc.expires_at,
      subscription_status: acc.subscription_status,
      is_active: acc.is_active
    }));
  }, [igAccounts, plan?.all_accounts_plans]);

  const paidAccountsCount = useMemo(() => {
    return allAccounts.filter((a) => a.is_active && a.plan_code !== 'free').length;
  }, [allAccounts]);

  const freeAccountsCount = useMemo(() => {
    return allAccounts.filter((a) => !a.is_active || a.plan_code === 'free').length;
  }, [allAccounts]);

  if (loading) {
    return (
      <LoadingOverlay
        variant="fullscreen"
        message="Loading subscription details"
        subMessage="Syncing your Instagram accounts and billing status..."
      />
    );
  }

  return (
    <>
      {syncingPlan && (
        <LoadingOverlay
          variant="fullscreen"
          message="Updating your subscription"
          subMessage="Syncing account plan permissions and applying limits..."
        />
      )}

      <div className="mx-auto max-w-7xl space-y-8 p-3 sm:p-5 md:p-8">
        {/* Top Notification Banner for Payment Success */}
        {upgradeSuccessMessage && (
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-primary/10 p-5 text-foreground shadow-md animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="font-black text-base text-foreground flex items-center gap-2">
                  Subscription Activated Successfully! <Sparkles size={16} className="text-amber-500" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{upgradeSuccessMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setUpgradeSuccessMessage(null)}
                className="rounded-xl border border-border/70 bg-card px-3.5 py-2 text-xs font-bold hover:bg-muted transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Header with Title & Quick Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles size={12} />
                Subscription & Billing
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">&bull;</span>
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                Independent Per-Account Billing
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              My Plan & Accounts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Monitor active Instagram subscriptions, track usage limits, and upgrade individual accounts seamlessly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => refreshAfterPayment()}
              disabled={syncingPlan}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted active:scale-95 shadow-xs"
              title="Refresh Plan Details"
            >
              <RefreshCw size={14} className={syncingPlan ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setCurrentView('Transactions')}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted active:scale-95 shadow-xs"
            >
              <CreditCard size={14} />
              Invoices
            </button>
            <button
              onClick={() => openCheckout()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Zap size={14} />
              Upgrade Plan
            </button>
          </div>
        </div>

        {planError && (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle size={18} className="shrink-0" />
            <p>{planError}</p>
          </div>
        )}

        {/* SECTION 1: Active Overview Hero & Limit Gauges */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Active Account Plan Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs lg:col-span-8 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Active Subscription
                  </span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">
                    Cycle: {(plan?.active_account_plan?.billing_cycle || 'monthly').toUpperCase()}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    statusBadge.bg
                  )}
                >
                  <div className={cn('h-1.5 w-1.5 rounded-full', statusBadge.dot)} />
                  {statusBadge.label}
                </div>
              </div>

              {/* Plan Title & Price */}
              <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
                <div>
                  <h2 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-bold text-foreground">
                    {currentPlanName}
                    <Zap className="fill-primary text-primary" size={22} />
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plan Code: <span className="font-mono font-medium uppercase text-foreground">{planCode}</span> &bull; Source: <span className="capitalize">{plan?.plan_source || 'system'}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-right">
                  <span className="text-2xl font-bold text-foreground">
                    ₹{plan?.active_account_plan?.plan_price || plan?.details?.price_monthly_inr || 0}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground"> / month</span>
                </div>
              </div>

              {/* Active Selected IG Account Highlight Card */}
              {plan?.active_account_plan ? (
                <div className="mb-6 rounded-xl border border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative">
                      {plan.active_account_plan.profile_picture_url ? (
                        <img
                          src={toBrowserPreviewUrl(plan.active_account_plan.profile_picture_url)}
                          alt={plan.active_account_plan.username}
                          className="h-11 w-11 rounded-full object-cover border border-border shadow-xs"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted border border-border text-foreground font-semibold text-sm shadow-xs">
                          {plan.active_account_plan.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted border border-border text-foreground shadow-xs">
                        <Instagram size={9} />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Active IG Account
                        </span>
                        {plan.active_account_plan.is_active && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Live
                          </span>
                        )}
                      </div>
                      <h3 className="truncate text-sm font-semibold text-foreground mt-0.5">
                        @{plan.active_account_plan.username}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => openAccountUpgrade(plan.active_account_plan!.account_id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-foreground hover:bg-foreground/90 px-3.5 py-2 text-xs font-medium text-background shadow-xs transition-all active:scale-98"
                    >
                      <Zap size={12} className="fill-background" />
                      Upgrade This Account
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Subscription Meta Chips */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                    <Calendar size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Expiry Date
                    </p>
                    <p className="truncate text-xs font-semibold text-foreground">
                      {formattedExpiryDate ? formattedExpiryDate : 'Permanent / Free'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                    <Clock size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Days Remaining
                    </p>
                    <p className="truncate text-xs font-semibold text-foreground">
                      {expiryDaysRemaining != null ? `${expiryDaysRemaining} Days` : 'Unlimited'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                    <ShieldCheck size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Billing Type
                    </p>
                    <p className="truncate text-xs font-semibold text-foreground">
                      {(plan?.active_account_plan?.billing_cycle || 'monthly').toUpperCase()} Recurring
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Need more accounts or custom agency quota?
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openCheckout()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                >
                  Change Plan Tier &rarr;
                </button>
              </div>
            </div>
          </div>
          {/* Right Column: Account Limits & Quota Gauge */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                      <Activity size={15} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Action Limits</h3>
                      <p className="text-[11px] text-muted-foreground">Per account automation limits</p>
                    </div>
                  </div>
                  <InfoPopover
                    title="Account Limits"
                    description="Each connected Instagram account operates with independent rate limits based on its assigned plan."
                    formula="Limits refresh continuously on hourly, daily, and 30-day sliding windows."
                    notes={[
                      'Upgrading an account increases its specific limits immediately.',
                      'Different Instagram accounts can have different plan tiers simultaneously.'
                    ]}
                  />
                </div>

                <div className="space-y-3 mt-4">
                  {/* Hourly Action Limit */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-muted-foreground">Hourly Action Limit</span>
                      <span className="font-semibold text-foreground">
                        {plan?.limits?.hourly_action_limit ?? 100} / hr
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full w-3/4" />
                    </div>
                  </div>

                  {/* Daily Action Limit */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-muted-foreground">Daily Action Limit</span>
                      <span className="font-semibold text-foreground">
                        {plan?.limits?.daily_action_limit ?? 500} / day
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full w-4/5" />
                    </div>
                  </div>

                  {/* Monthly Action Limit */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-muted-foreground">Monthly Action Limit</span>
                      <span className="font-semibold text-foreground">
                        {plan?.limits?.monthly_action_limit == null
                          ? 'Unlimited'
                          : `${Number(plan.limits.monthly_action_limit).toLocaleString()} / mo`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full w-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounts Summary Pill */}
              <div className="mt-5 rounded-xl border border-border bg-muted/20 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background font-semibold text-xs">
                    <Users size={13} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {allAccounts.length} Linked {allAccounts.length === 1 ? 'Account' : 'Accounts'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {paidAccountsCount} Paid &bull; {freeAccountsCount} Free
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openCheckout()}
                  className="text-xs font-medium text-foreground hover:underline"
                >
                  Upgrade +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: All Instagram Accounts & Individual Plan Upgrade Grid */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-border">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                  <Instagram size={16} />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Instagram Accounts & Plans
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Each Instagram account has its own independent subscription plan. Upgrade or manage any account individually.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {allAccounts.length} Connected {allAccounts.length === 1 ? 'Account' : 'Accounts'}
              </span>
            </div>
          </div>

          {/* Accounts Grid */}
          {allAccounts.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {allAccounts.map((account) => {
                const isSelectedActive =
                  account.account_id === activeAccountID ||
                  (plan?.active_account_plan && plan.active_account_plan.account_id === account.account_id);
                const isAccountPaid = account.is_active && account.plan_code !== 'free';
                const parsedAccExpiry = account.expires_at ? new Date(account.expires_at) : null;
                const accExpiryFormatted = parsedAccExpiry && !Number.isNaN(parsedAccExpiry.getTime())
                  ? parsedAccExpiry.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : null;

                return (
                  <div
                    key={account.account_id}
                    className={cn(
                      'relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-150 shadow-xs',
                      isSelectedActive
                        ? 'border-primary/40 bg-primary/[0.02]'
                        : 'border-border bg-card hover:border-primary/20'
                    )}
                  >
                    {/* Top Status & Plan Pill */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            {account.profile_picture_url ? (
                              <img
                                src={toBrowserPreviewUrl(account.profile_picture_url)}
                                alt={account.username}
                                className="h-10 w-10 rounded-full object-cover border border-border shadow-xs"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border text-foreground font-semibold text-sm shadow-xs">
                                {account.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted border border-border text-foreground shadow-xs">
                              <Instagram size={8} />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              @{account.username}
                            </h3>
                            <p className="text-[11px] text-muted-foreground truncate">
                              ID: {account.account_id}
                            </p>
                          </div>
                        </div>

                        {isSelectedActive && (
                          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Plan Badge & Status Details */}
                      <div className="rounded-lg border border-border bg-muted/20 p-3 mb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Plan Tier:</span>
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-xs font-semibold',
                              isAccountPaid
                                ? 'bg-foreground text-background'
                                : 'bg-muted text-muted-foreground border border-border'
                            )}
                          >
                            {account.plan_name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Price:</span>
                          <span className="text-xs font-semibold text-foreground">
                            {isAccountPaid ? `₹${account.plan_price}/mo` : 'Free Tier (₹0)'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Status:</span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium',
                              account.is_expired
                                ? 'text-destructive'
                                : account.is_active
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground'
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                account.is_expired
                                  ? 'bg-destructive'
                                  : account.is_active
                                  ? 'bg-emerald-500'
                                  : 'bg-muted-foreground'
                              )}
                            />
                            {account.is_expired ? 'Expired' : account.is_active ? 'Active' : 'Free Plan'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">Valid Until:</span>
                          <span className="text-xs font-medium text-foreground">
                            {accExpiryFormatted || 'Permanent Free'}
                          </span>
                        </div>
                      </div>

                      {/* Limits snapshot */}
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3">
                        <div className="rounded-lg border border-border bg-background p-1.5">
                          <p className="text-muted-foreground text-[10px]">Hourly</p>
                          <p className="font-semibold text-foreground">
                            {account.limits?.hourly_action_limit ?? 100}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background p-1.5">
                          <p className="text-muted-foreground text-[10px]">Daily</p>
                          <p className="font-semibold text-foreground">
                            {account.limits?.daily_action_limit ?? 500}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background p-1.5">
                          <p className="text-muted-foreground text-[10px]">Monthly</p>
                          <p className="font-semibold text-foreground">
                            {account.limits?.monthly_action_limit == null ? '∞' : `${Math.round(account.limits.monthly_action_limit / 1000)}k`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2.5 border-t border-border flex items-center gap-2">
                      {!isSelectedActive && (
                        <button
                          onClick={() => handleSelectAccount(account.account_id)}
                          className="flex-1 rounded-lg border border-border hover:bg-muted py-2 text-xs font-medium text-foreground transition-all"
                        >
                          Select
                        </button>
                      )}
                      <button
                        onClick={() => openAccountUpgrade(account.account_id)}
                        className={cn(
                          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all shadow-xs active:scale-98',
                          isAccountPaid
                            ? 'border border-border bg-background hover:bg-muted text-foreground'
                            : 'bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white hover:opacity-95'
                        )}
                      >
                        <Zap size={12} className={isAccountPaid ? 'text-foreground' : 'fill-white text-white'} />
                        {isAccountPaid ? 'Change Plan' : 'Upgrade Plan'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground mb-3">
                <Instagram size={20} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No Instagram Accounts Connected</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Connect your Instagram account from Account Settings to link and manage plans for individual handles.
              </p>
              <button
                onClick={() => setCurrentView('Account Settings')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-medium text-background hover:bg-foreground/90 transition-all"
              >
                Go to Account Settings &rarr;
              </button>
            </div>
          )}
        </div>

        {/* SECTION 3: Active Account Features Breakdown */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5 pb-5 border-b border-border">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Entitlements & Features
              </span>
              <h2 className="text-lg font-bold text-foreground mt-0.5">
                {currentPlanName} Features Included
              </h2>
              <p className="text-xs text-muted-foreground">
                All features unlocked for your currently active Instagram subscription.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                Fully Enabled
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {(plan?.active_account_plan?.details?.features || plan?.details?.features || []).map(
              (feature, index) => (
                <div
                  key={`${feature}-${index}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 p-3 transition-all"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check size={11} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-medium text-foreground">{feature}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* SECTION 4: Available Plans & Upgrade Catalog */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-5 border-b border-border">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Available Upgrades
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                Explore All Subscription Tiers
              </h2>
              <p className="text-xs text-muted-foreground max-w-xl">
                Choose the best plan for your automation volume. Plans apply per Instagram account.
              </p>
            </div>

            {/* Currency & Billing Cycle Toggles */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setIsYearly(false)}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-medium transition-all',
                    !isYearly
                      ? 'bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setIsYearly(true)}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-medium transition-all flex items-center gap-1.5',
                    isYearly
                      ? 'bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Yearly
                  <span className="rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 text-[10px] font-semibold">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          {plansLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 rounded-2xl border border-border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : plansError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {plansError}
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No plans are available right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((entry) => {
                const bigPrice = getPlanBigPrice(entry, currency, isYearly);
                const billedTotal = getPlanBilledTotal(entry, currency, isYearly);
                const isCurrentPlan = isCurrentPricingPlan(entry);
                const isUnavailable = entry.plan_code === 'free' || isCurrentPlan;
                const isUltra = entry.plan_code === 'ultra' || entry.name.toLowerCase().includes('ultra');
                const planLimits = buildPlanLimitItems(entry);

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'relative flex flex-col justify-between rounded-2xl p-6 text-foreground transition-all duration-150 border bg-card shadow-xs',
                      entry.is_popular
                        ? 'border-primary/50 ring-1 ring-primary/20'
                        : isUltra
                        ? 'border-border'
                        : 'border-border',
                      isUnavailable ? 'opacity-80' : ''
                    )}
                  >
                    {entry.is_popular && (
                      <div className="absolute -top-2.5 right-5 rounded-md bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                        Popular
                      </div>
                    )}
                    {isUltra && !entry.is_popular && (
                      <div className="absolute -top-2.5 right-5 rounded-md bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground shadow-xs">
                        Bonus Included
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-bold text-foreground">{entry.name}</h3>

                      <div className="mt-3.5 mb-5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold tracking-tight text-foreground">
                            {formatMoney(bigPrice, currency)}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            / account / mo
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isYearly
                            ? `Billed yearly at ${formatMoney(billedTotal, currency)} / account`
                            : `Billed monthly at ${formatMoney(billedTotal, currency)} / account`}
                        </p>
                        {isYearly && entry.yearly_bonus && (
                          <p className="mt-1 text-xs font-semibold text-emerald-500">
                            {entry.yearly_bonus}
                          </p>
                        )}

                        {/* Ultra Plan Bonus Box */}
                        {isUltra && (
                          <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <Gift size={13} className="text-muted-foreground" />
                              <span>VV Deals Included Bonus:</span>
                            </div>
                            <p className="mt-1 text-[11px] font-normal text-muted-foreground leading-snug">
                              {isYearly
                                ? '18m Google AI Pro, 6m Prime, 3m Spotify, 1m CapCut Pro, 1m Netflix (₹39,660 Value)'
                                : '1m Amazon Prime, 7 days CapCut Pro, 5 days Netflix on Mobile/TV (₹898 Value)'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Plan Limits Box */}
                      <div className="rounded-xl border border-border bg-muted/20 p-3.5 mb-5">
                        <p className="text-xs font-medium text-muted-foreground mb-2.5">
                          Included Limits
                        </p>
                        <div className="space-y-1.5">
                          {planLimits.map((item) => (
                            <div
                              key={`${entry.id}-${item.label}`}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-semibold text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Feature List */}
                      <div className="space-y-2.5 mb-5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Key Capabilities
                        </p>
                        {entry.features.map((feature, index) => (
                          <div key={`${entry.id}-${index}`} className="flex items-start gap-2 text-xs">
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <Check size={10} strokeWidth={2.5} />
                            </div>
                            <span className="text-muted-foreground font-normal">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="pt-5 border-t border-border">
                      <button
                        className={cn(
                          'flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-medium shadow-xs transition-all duration-150 active:scale-98',
                          isUnavailable
                            ? 'bg-muted text-muted-foreground shadow-none cursor-not-allowed'
                            : entry.is_popular
                            ? 'bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white hover:opacity-95'
                            : 'border border-border bg-background hover:bg-muted text-foreground'
                        )}
                        disabled={syncingPlan || isUnavailable}
                        onClick={() => openCheckout(entry)}
                      >
                        <CreditCard size={14} />
                        {isCurrentPlan
                          ? 'Current Active Plan'
                          : entry.plan_code === 'free'
                          ? 'Free Tier'
                          : `Choose ${entry.name}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 5: FAQs & Helpful Information */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
              <HelpCircle size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Frequently Asked Questions</h3>
              <p className="text-xs text-muted-foreground">Clear answers about billing, account upgrades, and limits</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h4 className="font-semibold text-xs text-foreground mb-1">
                How does per-account billing work?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Each Instagram handle linked to your DM Panda account has its own independent subscription and separate action limits. You can have one account on Ultra and another on Pro.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h4 className="font-semibold text-xs text-foreground mb-1">
                Can I upgrade accounts individually?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yes! Under the "Instagram Accounts & Plans" section above, click "Upgrade Plan" on any account card to launch the checkout specifically for that handle.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h4 className="font-semibold text-xs text-foreground mb-1">
                What happens when a plan expires?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When a paid subscription ends, that specific Instagram account gracefully transitions back to the permanent Free plan without losing your automation flows.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h4 className="font-semibold text-xs text-foreground mb-1">
                Where can I download invoices and receipts?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Head to the Transactions tab in your left navigation menu to view full payment receipts and download PDF invoices anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Checkout Modal with target account preselection */}
      <PlanCheckoutModal
        isOpen={checkoutOpen}
        plans={plans}
        currentPlan={plan}
        initialPlanId={selectedCheckoutPlanId}
        targetAccountId={targetCheckoutAccountId}
        defaultBillingCycle={isYearly ? 'yearly' : 'monthly'}
        currency={currency}
        countryCode={countryCode}
        authenticatedFetch={authenticatedFetch}
        loadingPlanId={paymentLoading}
        syncingPlan={syncingPlan}
        igAccounts={checkoutIgAccounts}
        onClose={() => {
          setCheckoutOpen(false);
          setTargetCheckoutAccountId(null);
        }}
        onPaymentSuccess={(planName) => {
          setPaymentLoading(null);
          setSelectedCheckoutPlanId(null);
          setTargetCheckoutAccountId(null);
          const msg = `You have successfully activated the ${planName}! All features and slots are ready.`;
          setUpgradeSuccessMessage(msg);
          showSuccess(`🎉 ${msg}`);
        }}
        onSyncComplete={refreshAfterPayment}
      />
    </>
  );
};

export default MyPlanView;
