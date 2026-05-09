import React, { useEffect, useMemo, useState } from 'react';
import { Check, CreditCard, Sparkles, X } from 'lucide-react';
import Card from '../../components/ui/card';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import InfoPopover from '../../components/ui/InfoPopover';
import { useAuth } from '../../contexts/AuthContext';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import { PricingPlan, formatMoney, formatPlanLimit, getPaidCheckoutPlans, getPlanBigPrice, getPlanBilledTotal, normalizePricingPayload } from '../../lib/pricing';
import PlanCheckoutModal from '../../components/dashboard/PlanCheckoutModal';

type UserPlanSummary = {
  plan_id: string;
  details?: {
    name?: string;
  } | null;
} | null;

const PricingView: React.FC = () => {
  const { authenticatedFetch, checkAuth } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<UserPlanSummary>(null);
  const [loading, setLoading] = useState(true);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [isIndianUser, setIsIndianUser] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCheckoutPlanId, setSelectedCheckoutPlanId] = useState<string | null>(null);

  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);

  const fetchPricing = React.useCallback(async () => {
    const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`, {
      headers: pricingHeaders
    });
    const data = await response.json().catch(() => ({}));
    setPlans(normalizePricingPayload(data));
  }, [authenticatedFetch, pricingHeaders]);

  const fetchCurrentPlan = React.useCallback(async () => {
    const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`, {
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
        setIsIndianUser(geo.isIndianUser);
        setCurrency(geo.defaultCurrency);
        const headers = buildCountryHeaders(geo.countryCode);
        const [pricingResponse, currentPlanResponse] = await Promise.all([
          authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`, { headers }),
          authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`, { headers })
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

            {isIndianUser && (
              <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                <span className={currency === 'INR' ? 'text-foreground' : ''}>INR</span>
                <button
                  onClick={() => setCurrency((current) => current === 'INR' ? 'USD' : 'INR')}
                  className="relative h-5 w-10 rounded-full bg-muted"
                >
                  <div className={`absolute top-1 h-3 w-3 rounded-full bg-card transition-all ${currency === 'INR' ? 'left-1' : 'left-6'}`} />
                </button>
                <span className={currency === 'USD' ? 'text-foreground' : ''}>USD</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const bigPrice = getPlanBigPrice(plan, currency, isYearly);
            const billedTotal = getPlanBilledTotal(plan, currency, isYearly);
            const isCurrentPlan = plan.id === currentPlan?.plan_id || plan.name === currentPlan?.details?.name;
            const isSelectablePaidPlan = checkoutPlans.some((item) => item.id === plan.id);
            const isUnavailable = plan.plan_code === 'free' || (!isCurrentPlan && !isSelectablePaidPlan);
            const planLimits = [
              { label: 'Instagram connections', value: formatPlanLimit(plan.instagram_connections_limit) },
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
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">{formatMoney(bigPrice, currency)}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isYearly
                      ? `Billed yearly at ${formatMoney(billedTotal, currency)} for 364 days.`
                      : `Billed every 30 days at ${formatMoney(billedTotal, currency)}.`}
                  </p>
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
                      ? plan.feature_items.map((item) => ({ label: item.label || item.key, enabled: item.enabled }))
                      : plan.features.map((f) => ({ label: f, enabled: true }));
                    return allFeatures.map((feature, i) => (
                      <div key={`${plan.id}-${i}`} className={`flex items-start gap-3 text-sm ${!feature.enabled ? 'opacity-50' : ''}`}>
                        <div className={`mt-0.5 flex-shrink-0 ${feature.enabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {feature.enabled ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                        </div>
                        <span className={`text-muted-foreground ${!feature.enabled ? 'line-through decoration-muted-foreground' : ''}`}>{feature.label}</span>
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

export default PricingView;
