import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AlertCircle, Calendar, Check, ChevronDown, CreditCard, Instagram, Plus, RefreshCw, Sparkles, UserCheck, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import InfoPopover from '../../components/ui/InfoPopover';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import { PricingPlan, buildPlanLimitItems, formatMoney, getPaidCheckoutPlans, getPlanBigPrice, normalizePricingPayload, pricingPlanMatchesIdentifier } from '../../lib/pricing';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';
import PlanCheckoutModal from '../../components/dashboard/PlanCheckoutModal';

type AccountPlanDetail = {
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

type UserPlan = {
  plan_id: string;
  plan_code: string;
  assigned_plan_id?: string;
  plan_source?: string | null;
  expiry_date: string | null;
  is_active: boolean;
  is_expired: boolean;
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
  };
  active_account_plan?: AccountPlanDetail | null;
  other_accounts_plans?: AccountPlanDetail[];
  all_accounts_plans?: AccountPlanDetail[];
};

const MyPlanView: React.FC = () => {
  const { authenticatedFetch, checkAuth } = useAuth();
  const { igAccounts, activeAccountID, activeAccount, setActiveAccountID, setCurrentView, isInitialLoadComplete } = useDashboard();
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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCheckoutPlanId, setSelectedCheckoutPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const accountSwitcherRef = useRef<HTMLDivElement>(null);
  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);

  // Close account switcher on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountSwitcherRef.current && !accountSwitcherRef.current.contains(event.target as Node)) {
        setIsAccountSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMyPlan = React.useCallback(async (targetAccountId?: string | null) => {
    const accountId = targetAccountId !== undefined ? targetAccountId : activeAccountID;
    const queryParam = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
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
  }, [authenticatedFetch, pricingHeaders, activeAccountID]);

  const fetchPlans = React.useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`, {
        headers: pricingHeaders
      });
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
          authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`, { headers })
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

  // Re-fetch my-plan whenever activeAccountID changes after initial load
  useEffect(() => {
    if (!loading && isInitialLoadComplete) {
      void fetchMyPlan(activeAccountID);
    }
  }, [activeAccountID, fetchMyPlan, isInitialLoadComplete, loading]);

  const currentPlanName = String(plan?.active_account_plan?.plan_name || plan?.details?.name || 'Free Plan');
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

  const planCode = plan?.active_account_plan?.plan_code || plan?.plan_code || 'free';
  const isTemporaryFree = planCode === 'free' && Boolean(formattedExpiryDate);
  const isPermanentFree = planCode === 'free' && !formattedExpiryDate;
  const isExpired = Boolean(plan?.active_account_plan?.is_expired ?? plan?.is_expired);
  const isActive = Boolean(plan?.active_account_plan?.is_active ?? plan?.is_active);

  const statusLabel = isExpired
    ? 'Expired'
    : isTemporaryFree
      ? 'Temporary Free'
      : isPermanentFree
        ? 'Permanent Free'
        : isActive
          ? 'Active'
          : 'Inactive';

  const expiryLabel = isTemporaryFree
    ? `Temporary Free (expires on ${formattedExpiryDate})`
    : formattedExpiryDate
      ? `Valid until ${formattedExpiryDate}`
      : planCode === 'free'
        ? 'Permanent Free'
        : 'No expiry';

  const renderLimitValue = (value?: number | null) => {
    if (value == null) return 'Unlimited';
    return String(value);
  };

  const checkoutPlans = useMemo(() => {
    return getPaidCheckoutPlans(plans, plan?.plan_id, currentPlanName);
  }, [plans, plan?.plan_id, currentPlanName]);

  const isCurrentPricingPlan = React.useCallback((entry: PricingPlan) => {
    return pricingPlanMatchesIdentifier(entry, plan?.plan_id)
      || pricingPlanMatchesIdentifier(entry, plan?.plan_code)
      || pricingPlanMatchesIdentifier(entry, currentPlanName);
  }, [currentPlanName, plan?.plan_code, plan?.plan_id]);

  const openCheckout = (selectedPlan?: PricingPlan) => {
    setSelectedCheckoutPlanId(selectedPlan?.id || checkoutPlans[0]?.id || null);
    setCheckoutOpen(true);
  };

  const refreshAfterPayment = async () => {
    setSyncingPlan(true);
    try {
      await Promise.all([fetchMyPlan(activeAccountID), fetchPlans(), checkAuth()]);
    } finally {
      setSyncingPlan(false);
      setPaymentLoading(null);
    }
  };

  const handleSelectAccount = (accId: string) => {
    setActiveAccountID(accId);
    setIsAccountSwitcherOpen(false);
    void fetchMyPlan(accId);
  };

  // Find currently selected account from igAccounts
  const selectedAccount = useMemo(() => {
    if (!igAccounts || igAccounts.length === 0) return null;
    return igAccounts.find(a => (a.id === activeAccountID || a.ig_user_id === activeAccountID)) || igAccounts[0] || null;
  }, [igAccounts, activeAccountID]);

  if (loading) {
    return <LoadingOverlay variant="fullscreen" message="Loading your subscription" subMessage="Fetching plan details..." />;
  }

  return (
    <>
      {syncingPlan && (
        <LoadingOverlay
          variant="fullscreen"
          message="Refreshing your plan"
          subMessage="Waiting for the new subscription to appear on the dashboard..."
        />
      )}
      <div className="mx-auto max-w-6xl space-y-8 p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Page Title & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Subscription</h1>
            <p className="text-muted-foreground">Manage the active plan and review the next upgrades.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${isExpired ? 'bg-destructive-muted/40 text-destructive' : 'bg-success-muted/60 text-success'}`}>
            <div className={`h-2 w-2 rounded-full ${isExpired ? 'bg-destructive' : 'bg-success'}`} />
            {statusLabel}
          </div>
        </div>

        {planError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {planError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm md:col-span-2">
            <div className="absolute right-0 top-0 p-8 opacity-10">
              <Zap size={120} className="text-primary" />
            </div>
            <div className="relative">
              <span className="text-sm font-bold uppercase tracking-wider text-primary">Current Plan</span>
              <h2 className="mt-2 mb-6 flex items-center gap-3 text-2xl sm:text-4xl font-black text-foreground">
                {currentPlanName}
                <Zap className="fill-primary text-primary" size={28} />
              </h2>

              {/* Active Selected IG Account Plan Header */}
              {plan?.active_account_plan ? (
                <div className="mb-6 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {plan.active_account_plan.profile_picture_url ? (
                      <img src={toBrowserPreviewUrl(plan.active_account_plan.profile_picture_url)} alt={plan.active_account_plan.username} className="h-10 w-10 rounded-full object-cover border border-purple-500/30" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 text-white font-bold text-sm">
                        {plan.active_account_plan.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">ACTIVE INSTAGRAM ACCOUNT</p>
                      <h3 className="text-base font-bold text-foreground">@{plan.active_account_plan.username}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400">
                      ₹{plan.active_account_plan.plan_price}/mo
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="mb-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-muted-foreground">
                  <Calendar size={18} />
                  <span className="text-sm">
                    {expiryLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-muted-foreground">
                  <CreditCard size={18} />
                  <span className="text-sm">
                    Cycle: {(plan?.active_account_plan?.billing_cycle || 'monthly').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-muted-foreground">
                  <Zap size={18} />
                  <span className="text-sm">
                    Plan Code: {(plan?.active_account_plan?.plan_code || plan?.plan_code || 'free').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mb-8 space-y-4">
                <h3 className="font-bold text-foreground">Plan Features</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(plan?.active_account_plan?.details?.features || plan?.details?.features || []).map((feature, index) => (
                    <div key={`${feature}-${index}`} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success-muted/60 text-success">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Instagram Accounts Plans Section */}
              <div className="mt-8 rounded-2xl border border-border/80 bg-muted/30 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
                      <Instagram size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Other Instagram Accounts Plans</h4>
                      <p className="text-xs text-muted-foreground">Individual pricing plan and status for your remaining linked accounts</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {(plan?.other_accounts_plans || []).length} Other {(plan?.other_accounts_plans || []).length === 1 ? 'Account' : 'Accounts'}
                  </span>
                </div>

                {plan?.other_accounts_plans && plan.other_accounts_plans.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {plan.other_accounts_plans.map((otherAcc) => (
                      <div
                        key={otherAcc.account_id}
                        onClick={() => handleSelectAccount(otherAcc.account_id)}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 shadow-xs hover:border-primary/40 hover:bg-muted/40 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {otherAcc.profile_picture_url ? (
                            <img
                              src={toBrowserPreviewUrl(otherAcc.profile_picture_url)}
                              alt={otherAcc.username}
                              className="h-9 w-9 rounded-full object-cover border border-border/80 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 text-white font-bold text-xs">
                              {otherAcc.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                              @{otherAcc.username}
                            </p>
                            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                              {otherAcc.plan_name} &bull; ₹{otherAcc.plan_price}/mo
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${otherAcc.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                            {otherAcc.is_active ? 'Active' : 'Free / Inactive'}
                          </span>
                          <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                            Switch &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center">
                    <p className="text-xs font-medium text-muted-foreground">No other Instagram accounts connected.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-6">
              <div className="mb-4 flex items-center gap-3 text-primary">
                <AlertCircle size={20} />
                <h4 className="font-bold">Billing Windows</h4>
              </div>
              <p className="text-sm text-primary/80">
                Monthly plans run for 30 days. Yearly plans run for 364 days with a lower monthly-effective price.
              </p>
            </div>

            <div className="rounded-3xl bg-foreground p-6 text-background shadow-xl">
              <h4 className="mb-2 font-bold">Current Limits</h4>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Hourly actions</span>
                  <span>{renderLimitValue(plan?.limits?.hourly_action_limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Daily actions</span>
                  <span>{renderLimitValue(plan?.limits?.daily_action_limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly actions</span>
                  <span>{renderLimitValue(plan?.limits?.monthly_action_limit)}</span>
                </div>
              </div>
              {plan?.access_state?.automation_locked && (
                <div className="mt-4 rounded-2xl bg-background/10 px-3 py-3 text-xs text-background/80">
                  Automation access is locked. {plan?.access_state?.ban_message || 'Please contact support if you need help.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-foreground">Available Upgrades</h2>
              <p className="text-muted-foreground">All plans are visible here. Checkout lets you switch between paid plans and keeps free as the expiry fallback.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl bg-muted p-1">
                <button
                  onClick={() => setIsYearly(false)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${!isYearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsYearly(true)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${isYearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Yearly
                </button>
              </div>
            </div>
          </div>

          {plansLoading ? (
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Loading plans...</div>
          ) : plansError ? (
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{plansError}</div>
          ) : plans.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
              No plans are available right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((entry) => {
                const bigPrice = getPlanBigPrice(entry, currency, isYearly);
                const isCurrentPlan = isCurrentPricingPlan(entry);
                const isUnavailable = entry.plan_code === 'free' || isCurrentPlan;
                const planLimits = buildPlanLimitItems(entry);
                return (
                  <div
                    key={entry.id}
                    className={`relative flex flex-col rounded-3xl p-8 text-foreground transition-all duration-300 ${entry.is_popular ? 'scale-[1.02] border border-primary/40 bg-card shadow-xl ring-1 ring-primary/15' : 'border border-border bg-card hover:border-border/60 hover:shadow-xl'} ${isUnavailable ? 'opacity-75' : ''}`}
                  >
                    {entry.is_popular && (
                      <div className="absolute top-0 right-0 rounded-tr-2xl rounded-bl-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">
                        POPULAR
                      </div>
                    )}

                    <h3 className="mb-2 text-2xl font-bold">{entry.name}</h3>
                    <div className="mb-6 flex h-20 flex-col justify-center">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">{formatMoney(bigPrice, currency)}</span>
                        <span className="text-sm text-muted-foreground">/account /month</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {isYearly ? 'Yearly per-account total is shown in checkout.' : 'Monthly per-account total is shown in checkout.'}
                      </p>
                      {isYearly && entry.yearly_bonus && (
                        <p className="mt-1 text-sm font-medium text-success">{entry.yearly_bonus}</p>
                      )}
                    </div>

                    <div className="flex-grow space-y-4">
                      <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan limits</p>
                          <InfoPopover
                            title="Plan limits"
                            description="These limits apply separately to each linked Instagram account on the user."
                            formula="Every linked Instagram account gets its own hourly, daily, and monthly limit window."
                            notes={[
                              'Two linked Instagram accounts means two separate account limit windows.',
                              'Changing the selected Instagram account updates the account-specific gauge usage.'
                            ]}
                            className="shrink-0"
                          />
                        </div>
                        <div className="mt-4 space-y-3">
                          {planLimits.map((item) => (
                            <div key={`${entry.id}-${item.label}`} className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-semibold text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {entry.features.map((feature, index) => (
                        <div key={`${entry.id}-${index}`} className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 text-success">
                            <Check size={16} strokeWidth={3} />
                          </div>
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className={`mt-8 border-t pt-6 ${entry.is_popular ? 'border-primary/30' : 'border-border'}`}>
                      <button
                        className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl py-4 text-xs font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-300 ${isUnavailable ? 'bg-muted text-muted-foreground shadow-none cursor-not-allowed' : entry.is_popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-background hover:opacity-90'}`}
                        disabled={syncingPlan || isUnavailable}
                        onClick={() => openCheckout(entry)}
                      >
                        <CreditCard size={16} />
                        {isCurrentPlan ? 'Current Plan' : entry.plan_code === 'free' ? 'Free On Expiry' : 'Change Plan'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PlanCheckoutModal
        isOpen={checkoutOpen}
        plans={plans}
        currentPlan={plan}
        initialPlanId={selectedCheckoutPlanId}
        defaultBillingCycle={isYearly ? 'yearly' : 'monthly'}
        currency={currency}
        countryCode={countryCode}
        authenticatedFetch={authenticatedFetch}
        loadingPlanId={paymentLoading}
        syncingPlan={syncingPlan}
        igAccounts={igAccounts}
        onClose={() => setCheckoutOpen(false)}
        onPaymentSuccess={() => {
          setPaymentLoading(null);
          setSelectedCheckoutPlanId(null);
        }}
        onSyncComplete={refreshAfterPayment}
      />
    </>
  );
};

export default MyPlanView;

