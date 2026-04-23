import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Check, CreditCard, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import { PricingPlan, formatMoney, getPaidCheckoutPlans, getPlanBigPrice, normalizePricingPayload } from '../../lib/pricing';
import { formatShortDate } from '../../lib/date';
import PlanCheckoutModal from '../../components/dashboard/PlanCheckoutModal';

type UserPlan = {
  plan_id: string;
  assigned_plan_id?: string;
  status: string;
  expires: string | null;
  access_state?: {
    automation_locked?: boolean;
    ban_message?: string | null;
  } | null;
  details: {
    name: string;
    features: string[];
    price_monthly_inr: number;
    price_monthly_usd: number;
    price_yearly_inr?: number;
    price_yearly_usd?: number;
    price_yearly_monthly_inr?: number;
    price_yearly_monthly_usd?: number;
    yearly_bonus?: string;
  } | null;
  limits?: {
    hourly_action_limit?: number;
    daily_action_limit?: number;
    monthly_action_limit?: number;
  };
};

const MyPlanView: React.FC = () => {
  const { authenticatedFetch, checkAuth } = useAuth();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [isIndianUser, setIsIndianUser] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCheckoutPlanId, setSelectedCheckoutPlanId] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);

  const fetchMyPlan = React.useCallback(async () => {
    const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`, {
      headers: pricingHeaders
    });
    if (!response.ok) {
      setPlan(null);
      setPlanError('We could not confirm your latest plan details. Please try again.');
      return;
    }
    const data = await response.json().catch(() => null);
    setPlan(data);
    setPlanError(null);
  }, [authenticatedFetch, pricingHeaders]);

  const fetchPlans = React.useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`, {
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
        setIsIndianUser(geo.isIndianUser);
        setCurrency(geo.defaultCurrency);
        const headers = buildCountryHeaders(geo.countryCode);
        const [planResponse, pricingResponse] = await Promise.all([
          authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`, { headers }),
          authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`, { headers })
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
  }, [authenticatedFetch]);

  const currentPlanName = String(plan?.details?.name || 'Free Plan');
  const isExpired = plan?.status === 'expired' || Boolean(plan?.expires && new Date(plan.expires) < new Date());
  const renderLimitValue = (value?: number | null) => {
    if (value == null) return 'Unlimited';
    return String(value);
  };

  const checkoutPlans = useMemo(() => {
    return getPaidCheckoutPlans(plans, plan?.plan_id, currentPlanName);
  }, [plans, plan?.plan_id, currentPlanName]);

  const openCheckout = (selectedPlan?: PricingPlan) => {
    setSelectedCheckoutPlanId(selectedPlan?.id || checkoutPlans[0]?.id || null);
    setCheckoutOpen(true);
  };

  const refreshAfterPayment = async () => {
    setSyncingPlan(true);
    try {
      await Promise.all([fetchMyPlan(), fetchPlans(), checkAuth()]);
    } finally {
      setSyncingPlan(false);
      setPaymentLoading(null);
    }
  };

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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Subscription</h1>
            <p className="text-muted-foreground">Manage the active plan and review the next upgrades.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${isExpired ? 'bg-destructive-muted/40 text-destructive' : 'bg-success-muted/60 text-success'}`}>
            <div className={`h-2 w-2 rounded-full ${isExpired ? 'bg-destructive' : 'bg-success'}`} />
            {isExpired ? 'Expired' : 'Active'}
          </div>
        </div>

        {planError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {planError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-sm md:col-span-2">
            <div className="absolute right-0 top-0 p-8 opacity-10">
              <Zap size={120} className="text-primary" />
            </div>
            <div className="relative">
              <span className="text-sm font-bold uppercase tracking-wider text-primary">Current Plan</span>
              <h2 className="mt-2 mb-6 flex items-center gap-3 text-4xl font-black text-foreground">
                {currentPlanName}
                <Zap className="fill-primary text-primary" size={28} />
              </h2>

              <div className="mb-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-muted-foreground">
                  <Calendar size={18} />
                  <span className="text-sm">
                    {plan?.expires ? `Valid until ${formatShortDate(plan.expires)}` : 'No expiry on record'}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-muted-foreground">
                  <CreditCard size={18} />
                  <span className="text-sm">
                    Assigned plan: {String(plan?.assigned_plan_id || plan?.plan_id || 'free').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-muted-foreground">
                  <Zap size={18} />
                  <span className="text-sm">
                    Effective plan: {String(plan?.plan_id || 'free').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mb-8 space-y-4">
                <h3 className="font-bold text-foreground">Plan Features</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(plan?.details?.features || []).map((feature, index) => (
                    <div key={`${feature}-${index}`} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success-muted/60 text-success">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
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
              {isIndianUser && (
                <button
                  onClick={() => setCurrency((current) => current === 'INR' ? 'USD' : 'INR')}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  {currency}
                </button>
              )}
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
                const isCurrentPlan = entry.id === plan?.plan_id || entry.name === currentPlanName;
                const isSelectablePaidPlan = checkoutPlans.some((item) => item.id === entry.id);
                const isUnavailable = entry.plan_code === 'free' || (!isCurrentPlan && !isSelectablePaidPlan);
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
                        <span className="text-sm text-muted-foreground">/month</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {isYearly ? 'Yearly total is shown in checkout.' : 'Monthly total is shown in checkout.'}
                      </p>
                      {isYearly && entry.yearly_bonus && (
                        <p className="mt-1 text-sm font-medium text-success">{entry.yearly_bonus}</p>
                      )}
                    </div>

                    <div className="flex-grow space-y-4">
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
                        className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl py-4 text-xs font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-300 ${isCurrentPlan || isUnavailable ? 'bg-muted text-muted-foreground shadow-none cursor-not-allowed' : entry.is_popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-background hover:opacity-90'}`}
                        disabled={syncingPlan || isCurrentPlan || isUnavailable}
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
        canToggleCurrency={isIndianUser}
        onCurrencyToggle={() => setCurrency((current) => current === 'INR' ? 'USD' : 'INR')}
        authenticatedFetch={authenticatedFetch}
        loadingPlanId={paymentLoading}
        syncingPlan={syncingPlan}
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
