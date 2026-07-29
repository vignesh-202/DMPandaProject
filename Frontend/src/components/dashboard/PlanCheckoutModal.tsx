import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckSquare, Instagram, Loader2, Minus, Percent, Plus, ShieldCheck, Square, Users, X } from 'lucide-react';
import { buildCountryHeaders } from '../../lib/geoCurrency';
import {
  PricingPlan,
  findPricingPlan,
  formatMoney,
  getPlanBilledTotal,
  getPaidCheckoutPlans
} from '../../lib/pricing';
import { cn } from '../../lib/utils';
import { FAST_TRANSITION } from '../../lib/animation';

export type IgAccountItem = {
  id: string;
  ig_user_id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  status?: string;
  is_active?: boolean;
};

type CheckoutQuote = {
  billing_cycle: 'monthly' | 'yearly';
  currency: 'INR';
  accounts_count: number;
  unit_base_amount: number;
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
  currency?: 'INR';
  countryCode: string | null;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  loadingPlanId?: string | null;
  syncingPlan?: boolean;
  igAccounts?: IgAccountItem[];
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

const AccountAvatar: React.FC<{ url?: string; username?: string; name?: string }> = ({ url, username, name }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  const displayName = name || username || 'IG';
  const initial = displayName.charAt(0).toUpperCase();

  if (url && !hasError) {
    return (
      <img
        src={url}
        alt={username || 'Instagram Account'}
        onError={() => setHasError(true)}
        className="h-10 w-10 rounded-full object-cover border border-border/80 shadow-sm"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 text-white font-bold text-sm shadow-sm">
      {initial}
    </div>
  );
};

const PlanCheckoutModal: React.FC<PlanCheckoutModalProps> = ({
  isOpen,
  plans,
  currentPlan,
  initialPlanId,
  defaultBillingCycle = 'monthly',
  currency = 'INR',
  countryCode,
  authenticatedFetch,
  loadingPlanId,
  syncingPlan = false,
  igAccounts,
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
  const [localAccounts, setLocalAccounts] = useState<IgAccountItem[]>(igAccounts || []);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [extraSlots, setExtraSlots] = useState<number>(0);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponState, setCouponState] = useState<CouponState | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);
  const selectedPlan = useMemo(
    () => findPricingPlan(eligiblePlans, selectedPlanId),
    [eligiblePlans, selectedPlanId]
  );

  // Sync prop accounts or fetch linked accounts if missing
  useEffect(() => {
    if (!isOpen) return;

    if (Array.isArray(igAccounts) && igAccounts.length > 0) {
      setLocalAccounts(igAccounts);
      const allIds = new Set<string>(igAccounts.map((acc) => String(acc.id || acc.ig_user_id)));
      setSelectedAccountIds(allIds);
      setExtraSlots(0);
    } else {
      let cancelled = false;
      setIsLoadingAccounts(true);
      const fetchAccounts = async () => {
        try {
          const res = await authenticatedFetch(
            `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/account/ig-accounts`
          );
          if (res.ok) {
            const data = await res.json().catch(() => null);
            const fetched = Array.isArray(data?.ig_accounts) ? data.ig_accounts : [];
            if (!cancelled) {
              setLocalAccounts(fetched);
              const allIds = new Set<string>(fetched.map((acc: IgAccountItem) => String(acc.id || acc.ig_user_id)));
              setSelectedAccountIds(allIds);
              setExtraSlots(0);
            }
          }
        } catch (err) {
          console.error('Failed to load IG accounts for checkout:', err);
        } finally {
          if (!cancelled) setIsLoadingAccounts(false);
        }
      };
      void fetchAccounts();
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, igAccounts, authenticatedFetch]);

  // Derived billable accounts count
  const accountsCount = useMemo(() => {
    const selectedCount = selectedAccountIds.size;
    const total = selectedCount + extraSlots;
    if (localAccounts.length === 0) {
      return Math.max(1, extraSlots > 0 ? extraSlots : 1);
    }
    return Math.max(1, total);
  }, [selectedAccountIds.size, extraSlots, localAccounts.length]);

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
        const response = await authenticatedFetch(
          `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/coupons/validate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...pricingHeaders
            },
            body: JSON.stringify({
              plan_id: selectedPlan.id,
              billing_cycle: billingCycle,
              currency,
              accounts_count: accountsCount
            })
          }
        );
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
  }, [authenticatedFetch, billingCycle, currency, isOpen, pricingHeaders, selectedPlan, accountsCount]);

  useEffect(() => {
    setCouponState(null);
  }, [selectedPlanId, billingCycle, currency, accountsCount]);

  if (!isOpen) return null;

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>(localAccounts.map((acc) => String(acc.id || acc.ig_user_id)));
    setSelectedAccountIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedAccountIds(new Set<string>());
    if (extraSlots === 0) {
      setExtraSlots(1);
    }
  };

  const handleApplyCoupon = async () => {
    if (!selectedPlan) return;

    setIsApplyingCoupon(true);
    try {
      const response = await authenticatedFetch(
        `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/coupons/validate`,
        {
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
            accounts_count: accountsCount
          })
        }
      );
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
      const createOrder = await authenticatedFetch(
        `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/create-order`,
        {
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
            accounts_count: accountsCount
          })
        }
      );
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
        const verifyResponse = await authenticatedFetch(
          `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/verify-payment`,
          {
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
              payment_attempt_id: orderPayload?.payment_attempt_id || undefined,
              accounts_count: accountsCount
            })
          }
        );

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
          setIsVerifyingPayment(true);
          try {
            const verifyResponse = await authenticatedFetch(
              `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/verify-payment`,
              {
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
                  payment_attempt_id: orderPayload?.payment_attempt_id || undefined,
                  accounts_count: accountsCount
                })
              }
            );

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
          } finally {
            setIsVerifyingPayment(false);
          }
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

  const unitBasePrice = quote?.unit_base_amount ?? (selectedPlan ? getPlanBilledTotal(selectedPlan, currency, billingCycle === 'yearly') : 0);
  const billedTotal = quote?.base_amount ?? (unitBasePrice * accountsCount);
  const discountAmount = quote?.discount ?? 0;
  const finalAmount = quote?.final_amount ?? billedTotal;

  const selectedConnectedAccounts = localAccounts.filter((acc) =>
    selectedAccountIds.has(String(acc.id || acc.ig_user_id))
  );

  const overlayRoot = typeof document !== 'undefined'
    ? (document.querySelector('[data-dashboard-section-overlay-root]') as HTMLElement | null)
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
      <div
        className={cn(
          'relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_36px_120px_rgba(15,23,42,0.22)]',
          isSectionViewportOverlay ? 'max-h-[calc(100%-2rem)]' : 'max-h-[92vh]'
        )}
      >
        {isVerifyingPayment && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-bold text-foreground">Verifying your payment...</p>
            <p className="mt-1 text-xs text-muted-foreground">Please do not close this window.</p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card/90 text-muted-foreground transition hover:text-foreground"
          aria-label="Close checkout"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-h-0 overflow-y-auto border-b border-border p-4 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary/75">Checkout</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Select Accounts & Plan</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose which Instagram accounts to include in your subscription plan, or reserve extra account slots.
              </p>

              {/* Billing Cycle Switch */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-2xl border border-border bg-muted/50 p-1">
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
                <span className="text-xs font-semibold text-muted-foreground">
                  {billingCycle === 'yearly' ? 'Save up to 20% on yearly plans' : 'Cancel or upgrade anytime'}
                </span>
              </div>

              {/* Instagram Account Selector Section */}
              <div className="mt-6 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
                      <Instagram className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Select Instagram Accounts</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedAccountIds.size} of {localAccounts.length} connected accounts selected
                      </p>
                    </div>
                  </div>

                  {localAccounts.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedAccountIds.size < localAccounts.length ? (
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Select All
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="text-xs font-bold text-muted-foreground hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Account Cards List */}
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {isLoadingAccounts ? (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your Instagram accounts...
                    </div>
                  ) : localAccounts.length > 0 ? (
                    localAccounts.map((account) => {
                      const id = String(account.id || account.ig_user_id);
                      const isSelected = selectedAccountIds.has(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleAccountSelection(id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl border p-3 text-left transition',
                            isSelected
                              ? 'border-primary/50 bg-primary/5 shadow-sm'
                              : 'border-border bg-background/50 hover:border-border/80'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <AccountAvatar
                              url={account.profile_picture_url}
                              username={account.username}
                              name={account.name}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-foreground">
                                {account.username ? `@${account.username}` : account.name || 'Instagram Account'}
                              </p>
                              {account.name && account.username && (
                                <p className="truncate text-xs text-muted-foreground">{account.name}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Connected
                            </span>
                            <div className={cn('text-primary transition', isSelected ? 'opacity-100' : 'opacity-40')}>
                              {isSelected ? <CheckSquare className="h-5 w-5 fill-primary text-primary-foreground" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
                      <p className="text-sm font-medium text-foreground">No Instagram accounts connected yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        You can purchase plan slots now and link your Instagram accounts anytime in Account Settings.
                      </p>
                    </div>
                  )}
                </div>

                {/* Extra Account Slots Stepper */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Reserve Extra Account Slots</p>
                    <p className="text-[11px] text-muted-foreground">Add slots for accounts you plan to link later.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
                    <button
                      type="button"
                      onClick={() => setExtraSlots((prev) => Math.max(0, prev - 1))}
                      disabled={extraSlots <= 0}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-foreground font-bold transition hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm font-black text-foreground">{extraSlots}</span>
                    <button
                      type="button"
                      onClick={() => setExtraSlots((prev) => Math.min(50, prev + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-foreground font-bold transition hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Total Billable Accounts:</span>
                  <span className="font-bold text-foreground">{accountsCount} {accountsCount === 1 ? 'Account' : 'Accounts'}</span>
                </div>
              </div>

              {/* Plan Cards List */}
              <div className="mt-6 grid gap-4">
                {eligiblePlans.map((entry) => {
                  const isSelected = entry.id === selectedPlanId;
                  const unitPrice = getPlanBilledTotal(entry, currency, billingCycle === 'yearly');
                  const totalPlanPrice = unitPrice * accountsCount;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedPlanId(entry.id)}
                      className={cn(
                        `rounded-[1.6rem] border p-4 text-left ${FAST_TRANSITION} sm:p-5`,
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
                              ? `${formatMoney(unitPrice, currency)} / account / yr (Total: ${formatMoney(totalPlanPrice, currency)} for ${accountsCount} ${accountsCount === 1 ? 'account' : 'accounts'})`
                              : `${formatMoney(unitPrice, currency)} / account / mo (Total: ${formatMoney(totalPlanPrice, currency)} for ${accountsCount} ${accountsCount === 1 ? 'account' : 'accounts'})`}
                          </p>
                        </div>
                        <div
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border',
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {entry.features.slice(0, 4).map((feature, index) => (
                          <div key={`${entry.id}-${index}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 text-emerald-500" />
                            <span className="min-w-0 break-words">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="min-h-0 overflow-y-auto bg-muted/30 p-4 sm:p-6 lg:p-8">
            <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">Order Summary</p>
              <h3 className="mt-3 text-xl font-black text-foreground">{selectedPlan?.name || 'Select a plan'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {billingCycle === 'yearly' ? 'Yearly billing' : 'Monthly billing'} &bull; {accountsCount} {accountsCount === 1 ? 'Account' : 'Accounts'}
              </p>

              {/* Covered Accounts Summary Pill */}
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                  <span>Covered Accounts</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{accountsCount} Total</span>
                </p>

                {selectedConnectedAccounts.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedConnectedAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center gap-2 text-xs text-foreground font-medium">
                        <AccountAvatar url={acc.profile_picture_url} username={acc.username} name={acc.name} />
                        <span className="truncate">@{acc.username || acc.name || 'Instagram Account'}</span>
                      </div>
                    ))}
                    {extraSlots > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold">
                          +{extraSlots}
                        </div>
                        <span>{extraSlots} extra account {extraSlots === 1 ? 'slot' : 'slots'}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {extraSlots > 0
                      ? `${extraSlots} unlinked account ${extraSlots === 1 ? 'slot' : 'slots'}`
                      : '1 account slot included'}
                  </div>
                )}
              </div>

              {/* Price Calculation Breakdown */}
              <div className="mt-5 space-y-3 rounded-[1.4rem] border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Accounts</span>
                  <span className="font-semibold text-foreground">{accountsCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rate / account</span>
                  <span className="font-semibold text-foreground">{formatMoney(unitBasePrice, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-foreground">{formatMoney(billedTotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className={cn('font-semibold', discountAmount > 0 ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {discountAmount > 0 ? `- ${formatMoney(discountAmount, currency)}` : formatMoney(0, currency)}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-black text-foreground">{formatMoney(finalAmount, currency)}</span>
                </div>
              </div>

              {/* Coupon Form */}
              <div className="mt-5">
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Coupon Code
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
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
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-border px-4 text-sm font-bold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[7rem]"
                  >
                    {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </button>
                </div>
                {couponState && (
                  <p className={cn('mt-2 text-sm font-medium', couponState.valid ? 'text-emerald-500' : 'text-destructive')}>
                    {couponState.message}
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleStartCheckout}
                disabled={!selectedPlan || isStartingCheckout || syncingPlan || loadingPlanId === selectedPlan?.id}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground px-5 text-sm font-black text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStartingCheckout || syncingPlan || loadingPlanId === selectedPlan?.id ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : finalAmount <= 0 ? (
                  'Activate Plan'
                ) : (
                  `Pay ${formatMoney(finalAmount, currency)}`
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


