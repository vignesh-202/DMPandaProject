import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Percent, ShieldCheck, X } from 'lucide-react';
import { buildCountryHeaders } from '../../lib/geoCurrency';
import {
  PricingPlan,
  findPricingPlan,
  formatMoney,
  getPlanBilledTotal,
  getPaidCheckoutPlans
} from '../../lib/pricing';
import { cn } from '../../lib/utils';

type CheckoutQuote = {
  billing_cycle: 'monthly' | 'yearly';
  currency: 'INR' | 'USD';
  base_amount: number;
  discount: number;
  final_amount: number;
  yearly_monthly_display_price: number;
  validity_days: number;
};

type CouponState = {
  valid: boolean;
  message: string;
};

type UserPlanSummary = {
  plan_id?: string | null;
  details?: {
    name?: string | null;
  } | null;
} | null;

interface PlanCheckoutModalProps {
  isOpen: boolean;
  plans: PricingPlan[];
  currentPlan: UserPlanSummary;
  initialPlanId?: string | null;
  defaultBillingCycle?: 'monthly' | 'yearly';
  currency: 'INR' | 'USD';
  countryCode: string | null;
  canToggleCurrency?: boolean;
  onCurrencyToggle?: () => void;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  loadingPlanId?: string | null;
  syncingPlan?: boolean;
  onClose: () => void;
  onPaymentSuccess?: (planName: string) => void;
  onSyncComplete?: () => Promise<void>;
}

const loadRazorpay = async () => {
  if ((window as any).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay.'));
    document.body.appendChild(script);
  });
};

const getCouponMessage = (reason: string) => {
  const normalized = String(reason || '').trim().toLowerCase();
  switch (normalized) {
    case 'missing':
      return 'Enter a coupon code to apply a discount.';
    case 'invalid':
      return 'This coupon code is not valid.';
    case 'inactive':
      return 'This coupon is not active right now.';
    case 'expired':
      return 'This coupon has expired.';
    case 'plan_not_eligible':
      return 'This coupon does not apply to the selected plan.';
    case 'user_not_eligible':
      return 'This coupon is not available for this account.';
    case 'usage_limit_reached':
      return 'This coupon has reached its usage limit.';
    case 'user_usage_limit_reached':
      return 'This coupon has already been used on this account.';
    default:
      return 'Coupon could not be applied.';
  }
};

const PlanCheckoutModal: React.FC<PlanCheckoutModalProps> = ({
  isOpen,
  plans,
  currentPlan,
  initialPlanId,
  defaultBillingCycle = 'monthly',
  currency,
  countryCode,
  canToggleCurrency = false,
  onCurrencyToggle,
  authenticatedFetch,
  loadingPlanId,
  syncingPlan = false,
  onClose,
  onPaymentSuccess,
  onSyncComplete
}) => {
  const eligiblePlans = useMemo(
    () => getPaidCheckoutPlans(plans, currentPlan?.plan_id, currentPlan?.details?.name),
    [plans, currentPlan]
  );

  const resolvedInitialPlanId = useMemo(() => {
    if (findPricingPlan(eligiblePlans, initialPlanId)) {
      return String(initialPlanId);
    }
    return eligiblePlans[0]?.id || '';
  }, [eligiblePlans, initialPlanId]);

  const [selectedPlanId, setSelectedPlanId] = useState(resolvedInitialPlanId);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(defaultBillingCycle);
  const [couponCode, setCouponCode] = useState('');
  const [couponState, setCouponState] = useState<CouponState | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);
  const selectedPlan = useMemo(
    () => findPricingPlan(eligiblePlans, selectedPlanId),
    [eligiblePlans, selectedPlanId]
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPlanId(resolvedInitialPlanId);
    setBillingCycle(defaultBillingCycle);
    setCouponCode('');
    setCouponState(null);
    setQuote(null);
  }, [defaultBillingCycle, isOpen, resolvedInitialPlanId]);

  useEffect(() => {
    if (!isOpen || !selectedPlan) return;

    let cancelled = false;

    const fetchBaseQuote = async () => {
      try {
        const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/coupons/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...pricingHeaders
          },
          body: JSON.stringify({
            plan_id: selectedPlan.id,
            billing_cycle: billingCycle,
            currency
          })
        });
        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          setQuote(payload?.pricing || null);
        }
      } catch (error) {
        if (!cancelled) {
          setQuote(null);
        }
        console.error('Failed to load checkout quote:', error);
      }
    };

    void fetchBaseQuote();

    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, billingCycle, currency, isOpen, pricingHeaders, selectedPlan]);

  useEffect(() => {
    setCouponState(null);
  }, [selectedPlanId, billingCycle, currency]);

  if (!isOpen) return null;

  const handleApplyCoupon = async () => {
    if (!selectedPlan) return;

    setIsApplyingCoupon(true);
    try {
      const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...pricingHeaders
        },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          currency,
          coupon_code: couponCode.trim() || undefined
        })
      });
      const payload = await response.json().catch(() => null);
      setQuote(payload?.pricing || null);

      if (payload?.valid) {
        setCouponState({
          valid: true,
          message: payload?.coupon?.code ? `Coupon applied: ${payload.coupon.code}` : 'Coupon applied.'
        });
        return;
      }

      setCouponState({
        valid: false,
        message: getCouponMessage(String(payload?.reason || 'invalid'))
      });
    } catch (error) {
      console.error('Coupon validation failed:', error);
      setCouponState({
        valid: false,
        message: 'Coupon could not be applied right now.'
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleStartCheckout = async () => {
    if (!selectedPlan) return;

    setIsStartingCheckout(true);
    try {
      const createOrder = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...pricingHeaders
        },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          currency,
          coupon_code: couponCode.trim() || undefined
        })
      });
      const orderPayload = await createOrder.json().catch(() => ({}));

      if (!createOrder.ok) {
        setCouponState({
          valid: false,
          message: String(orderPayload?.reason || '').trim()
            ? getCouponMessage(String(orderPayload.reason))
            : String(orderPayload?.error || 'Failed to start checkout.')
        });
        return;
      }

      setQuote(orderPayload?.pricing || null);
      if (orderPayload?.pricing?.coupon?.code) {
        setCouponState({
          valid: true,
          message: `Coupon applied: ${orderPayload.pricing.coupon.code}`
        });
      }

      if (orderPayload?.no_payment_required) {
        const verifyResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...pricingHeaders
          },
          body: JSON.stringify({
            plan_id: selectedPlan.id,
            billing_cycle: billingCycle,
            currency,
            coupon_code: couponCode.trim() || undefined,
            payment_attempt_id: orderPayload?.payment_attempt_id || undefined
          })
        });

        const verifyPayload = await verifyResponse.json().catch(() => null);
        if (!verifyResponse.ok) {
          setCouponState({
            valid: false,
            message: String(verifyPayload?.error || 'Failed to activate this plan.')
          });
          return;
        }

        if (onSyncComplete) {
          await onSyncComplete();
        }
        onPaymentSuccess?.(selectedPlan.name);
        onClose();
        return;
      }

      await loadRazorpay();

      const rzp = new (window as any).Razorpay({
        key: orderPayload?.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: 'DM Panda',
        description: `${selectedPlan.name} ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} subscription`,
        order_id: orderPayload.order.id,
        handler: async (response: any) => {
          const verifyResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...pricingHeaders
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: selectedPlan.id,
              billing_cycle: billingCycle,
              currency,
              coupon_code: couponCode.trim() || undefined,
              payment_attempt_id: orderPayload?.payment_attempt_id || undefined
            })
          });

          const verifyPayload = await verifyResponse.json().catch(() => null);

          if (!verifyResponse.ok) {
            setCouponState({
              valid: false,
              message: String(verifyPayload?.error || 'Payment verification failed. Please contact support.')
            });
            return;
          }

          if (onSyncComplete) {
            await onSyncComplete();
          }
          onPaymentSuccess?.(selectedPlan.name);
          onClose();
        },
        theme: { color: '#111111' }
      });

      rzp.open();
    } catch (error) {
      console.error('Checkout start failed:', error);
      setCouponState({
        valid: false,
        message: 'Something went wrong while starting payment.'
      });
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const billedTotal = quote?.base_amount ?? (selectedPlan ? getPlanBilledTotal(selectedPlan, currency, billingCycle === 'yearly') : 0);
  const discountAmount = quote?.discount ?? 0;
  const finalAmount = quote?.final_amount ?? billedTotal;

  const overlayRoot = typeof document !== 'undefined'
    ? document.querySelector('[data-dashboard-section-overlay-root]') as HTMLElement | null
    : null;
  const isSectionViewportOverlay = Boolean(overlayRoot);

  const modalContent = (
    <div
      className={cn(
        isSectionViewportOverlay
          ? 'pointer-events-auto absolute inset-0 z-[220] flex items-center justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:px-6'
          : 'fixed inset-0 z-[220] flex items-center justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:px-6'
      )}
    >
      <div className={cn(
        'relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_36px_120px_rgba(15,23,42,0.22)]',
        isSectionViewportOverlay ? 'max-h-[calc(100%-2rem)]' : 'max-h-[92vh]'
      )}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card/90 text-muted-foreground transition hover:text-foreground"
          aria-label="Close checkout"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-h-0 overflow-y-auto border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary/75">Checkout</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Choose your next plan</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Switch between paid plans here. Free stays available only after a paid subscription expires.
              </p>

              <div className="mt-6 inline-flex rounded-2xl border border-border bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-bold transition',
                    billingCycle === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-bold transition',
                    billingCycle === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  Yearly
                </button>
              </div>

              {canToggleCurrency && (
                <button
                  type="button"
                  onClick={onCurrencyToggle}
                  className="ml-3 inline-flex rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                >
                  {currency}
                </button>
              )}

              <div className="mt-6 grid gap-4">
                {eligiblePlans.map((entry) => {
                  const isSelected = entry.id === selectedPlanId;
                  const planPrice = getPlanBilledTotal(entry, currency, billingCycle === 'yearly');
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedPlanId(entry.id)}
                      className={cn(
                        'rounded-[1.6rem] border p-5 text-left transition',
                        isSelected
                          ? 'border-primary/40 bg-primary/5 shadow-[0_16px_40px_rgba(17,17,17,0.08)]'
                          : 'border-border bg-background/60 hover:border-border/80'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-foreground">{entry.name}</h3>
                            {entry.is_popular && (
                              <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary-foreground">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {billingCycle === 'yearly'
                              ? `Billed yearly at ${formatMoney(planPrice, currency)}`
                              : `Billed every 30 days at ${formatMoney(planPrice, currency)}`}
                          </p>
                        </div>
                        <div className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'
                        )}>
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {entry.features.slice(0, 4).map((feature, index) => (
                          <div key={`${entry.id}-${index}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 text-success" />
                            <span className="truncate">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-muted/30 p-5 sm:p-6 lg:p-8">
            <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">Order Summary</p>
              <h3 className="mt-3 text-xl font-black text-foreground">{selectedPlan?.name || 'Select a plan'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {billingCycle === 'yearly' ? 'Yearly billing' : 'Monthly billing'}
              </p>

              <div className="mt-5 space-y-3 rounded-[1.4rem] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan amount</span>
                  <span className="font-semibold text-foreground">{formatMoney(billedTotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className={cn('font-semibold', discountAmount > 0 ? 'text-success' : 'text-muted-foreground')}>
                    {discountAmount > 0 ? `- ${formatMoney(discountAmount, currency)}` : formatMoney(0, currency)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-black text-foreground">{formatMoney(finalAmount, currency)}</span>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Coupon Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                      placeholder="Enter coupon"
                      className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary/40"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !selectedPlan}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </button>
                </div>
                {couponState && (
                  <p className={cn('mt-2 text-sm font-medium', couponState.valid ? 'text-success' : 'text-destructive')}>
                    {couponState.message}
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-primary/15 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4.5 w-4.5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Backend verified pricing</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The total here matches the live plan amount and coupon validation used at checkout.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={!selectedPlan || isStartingCheckout || syncingPlan || loadingPlanId === selectedPlan?.id}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground px-5 text-sm font-black text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStartingCheckout || syncingPlan || loadingPlanId === selectedPlan?.id ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  finalAmount <= 0 ? 'Activate Plan' : `Pay ${formatMoney(finalAmount, currency)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (overlayRoot) {
    return createPortal(modalContent, overlayRoot);
  }

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

export default PlanCheckoutModal;
