import React, { useEffect, useMemo, useState } from 'react';
import { Check, CreditCard, Sparkles, X } from 'lucide-react';
import Card from '../../components/ui/card';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import InfoPopover from '../../components/ui/InfoPopover';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import { PricingPlan, formatMoney, formatPlanLimit, getPaidCheckoutPlans, getPlanBigPrice, getPlanBilledTotal, normalizePricingPayload, pricingPlanMatchesIdentifier } from '../../lib/pricing';
import PlanCheckoutModal from '../../components/dashboard/PlanCheckoutModal';

type UserPlanSummary = {
  plan_id: string;
  details?: {
    name?: string;
  } | null;
} | null;

const PricingView: React.FC = () => {
  const { authenticatedFetch, checkAuth } = useAuth();
  const { igAccounts } = useDashboard();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<UserPlanSummary>(null);
  const [loading, setLoading] = useState(true);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const currency = 'INR';
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCheckoutPlanId, setSelectedCheckoutPlanId] = useState<string | null>(null);

  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);

  const fetchPricing = React.useCallback(async () => {
    const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`, {
      headers: pricingHeaders
    });
    const data = await response.json().catch(() => ({}));
    setPlans(normalizePricingPayload(data));
  }, [authenticatedFetch, pricingHeaders]);

  const fetchCurrentPlan = React.useCallback(async () => {
    const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/my-plan`, {
      headers: pricingHeaders
    });
    const data = await response.json().catch(() => null);
    setCurrentPlan(data);
  }, [authenticatedFetch, pricingHeaders]);

  useEffect(() => {
    const init = async () => {
      try {
        const geo = await detectGeoCurrency();
        setCountryCode(geo.countryCode);
        const headers = buildCountryHeaders(geo.countryCode);
        const [pricingResponse, currentPlanResponse] = await Promise.all([
          authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`, { headers }),
          authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/my-plan`, { headers })
        ]);
        const pricingData = await pricingResponse.json().catch(() => ({}));
        const currentPlanData = await currentPlanResponse.json().catch(() => null);
        setPlans(normalizePricingPayload(pricingData));
        setCurrentPlan(currentPlanData);
      } catch (error) {
        console.error('Error initializing pricing:', error);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [authenticatedFetch]);

  const checkoutPlans = useMemo(() => {
    return getPaidCheckoutPlans(plans, currentPlan?.plan_id, currentPlan?.details?.name);
  }, [plans, currentPlan]);

  const isCurrentPricingPlan = React.useCallback((plan: PricingPlan) => {
    return pricingPlanMatchesIdentifier(plan, currentPlan?.plan_id)
      || pricingPlanMatchesIdentifier(plan, currentPlan?.details?.name || null);
  }, [currentPlan]);

  const refreshAfterPayment = async () => {
    setSyncingPlan(true);
    try {
      await Promise.all([
        fetchCurrentPlan(),
        fetchPricing(),
        checkAuth()
      ]);
    } finally {
      setSyncingPlan(false);
      setPaymentLoading(null);
    }
  };

  const openCheckout = (plan: PricingPlan) => {
    setSelectedCheckoutPlanId(plan.id);
    setCheckoutOpen(true);
  };

  if (loading) {
    return <LoadingOverlay variant="fullscreen" message="Loading pricing" subMessage="Fetching your latest plans..." />;
  }

  return (
    <>
      {syncingPlan && (
        <LoadingOverlay
          variant="fullscreen"
          message="Updating your subscription"
          subMessage="Waiting for the new plan to load on your dashboard..."
        />
      )}
      <div className="mx-auto mb-20 max-w-7xl animate-in fade-in p-3 duration-500 sm:p-4 md:p-6 lg:p-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 flex flex-wrap items-center justify-center gap-3 text-2xl sm:text-4xl font-black text-foreground">
            Upgrade Your Growth <Sparkles className="text-yellow-500" />
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Choose a higher plan, review the total on checkout, and apply a coupon before payment.
          </p>

          <div className="mt-10 flex flex-col items-center space-y-6">
            <div className="relative inline-flex rounded-2xl border border-border bg-muted p-1">
              <button
                onClick={() => setIsYearly(false)}
                className={`relative z-10 rounded-xl px-8 py-2 text-sm font-bold transition-all ${!isYearly ? 'bg-card text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`relative z-10 rounded-xl px-8 py-2 text-sm font-bold transition-all ${isYearly ? 'bg-card text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const bigPrice = getPlanBigPrice(plan, currency, isYearly);
            const billedTotal = getPlanBilledTotal(plan, currency, isYearly);
            const isCurrentPlan = isCurrentPricingPlan(plan);
            const isUnavailable = plan.plan_code === 'free' || isCurrentPlan;
            const planLimits = [
              { label: 'Instagram account slots', value: formatPlanLimit(plan.instagram_connections_limit) },
              { label: 'Actions / hour', value: formatPlanLimit(plan.actions_per_hour_limit) },
              { label: 'Actions / day', value: formatPlanLimit(plan.actions_per_day_limit) },
              { label: 'Actions / month', value: formatPlanLimit(plan.actions_per_month_limit) },
              { label: 'Once Per User / 24h', value: 'Included' },
              { label: 'Contacts', value: 'Unlimited' }
            ];
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col p-8 transition-all duration-300 ${plan.is_popular ? 'z-10 scale-105 border-2 border-primary shadow-2xl' : 'border-border hover:border-border/70'} ${isUnavailable ? 'opacity-75' : ''}`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-lg">
                    MOST POPULAR
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-4xl font-black text-foreground">{plan.plan_code === 'free' ? 'Free' : formatMoney(bigPrice, currency)}</span>
                    <span className="text-xs font-bold text-muted-foreground">{plan.plan_code === 'free' ? '' : '/account /month'}</span>
                  </div>
                  {plan.plan_code !== 'free' && (
                    <div className="mt-3 space-y-1.5 rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Monthly billing:</span>
                        <span className="font-bold text-foreground">{formatMoney(plan.price_monthly_inr, currency)}/mo <span className="text-[11px] font-semibold text-muted-foreground">({formatMoney(plan.price_monthly_inr * 12, currency)}/yr)</span></span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Yearly billing:</span>
                        <span className="font-bold text-emerald-500">{formatMoney(plan.price_yearly_monthly_inr, currency)}/mo <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">({formatMoney(plan.price_yearly_inr, currency)}/yr)</span></span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-6 rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan limits</p>
                    <InfoPopover
                      title="Plan limits"
                      description="These action limits apply separately to each linked Instagram account under the user."
                      formula="Each linked Instagram account gets its own hourly, daily, and monthly limit window."
                      notes={[
                        'If two Instagram accounts are linked, both accounts track usage independently.',
                        'Usage resets by account, not as one shared pool inside a user dashboard.'
                      ]}
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    {planLimits.map((item) => (
                      <div key={`${plan.id}-${item.label}`} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-8 flex-grow space-y-4">
                  {(() => {
                    const allFeatures = plan.feature_items
                      ? plan.feature_items.map((item) => ({ label: item.label || item.key, enabled: Boolean(item.enabled) }))
                      : (Array.isArray(plan.features) ? plan.features : []).map((f) => ({ label: String(f), enabled: true }));
                    return allFeatures.map((feature, i) => (
                      <div key={`${plan.id}-${i}`} className={`flex items-start gap-3 text-sm ${!feature.enabled ? 'opacity-50' : ''}`}>
                        <div className={`mt-0.5 flex-shrink-0 ${feature.enabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {feature.enabled ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                        </div>
                        <span className={`text-muted-foreground font-medium ${!feature.enabled ? 'line-through decoration-muted-foreground' : ''}`}>{feature.label}</span>
                      </div>
                    ));
                  })()}
                </div>

                <button
                  onClick={() => openCheckout(plan)}
                  disabled={!!paymentLoading || syncingPlan || isCurrentPlan || isUnavailable}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold transition-all ${isCurrentPlan || isUnavailable ? 'bg-muted text-muted-foreground shadow-none cursor-not-allowed' : plan.is_popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-background shadow-lg hover:opacity-90'}`}
                >
                  <CreditCard size={18} />
                  {isCurrentPlan ? 'Current Plan' : plan.plan_code === 'free' ? 'Free On Expiry' : 'Change Plan'}
                </button>
              </Card>
            );
          })}
        </div>
      </div>

      <PlanCheckoutModal
        isOpen={checkoutOpen}
        plans={plans}
        currentPlan={currentPlan}
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

export default PricingView;

