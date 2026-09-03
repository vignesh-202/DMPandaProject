import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckSquare,
  Instagram,
  Loader2,
  Minus,
  Percent,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Users,
  X
} from 'lucide-react';
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
  plan_code?: string;
  plan_name?: string;
  expires_at?: string | null;
  subscription_status?: string;
};

const PLAN_TIER_RANKS: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  ultra: 3
};

export const getPlanRank = (planIdentifier?: string | null): number => {
  const code = String(planIdentifier || '').trim().toLowerCase();
  if (code.includes('ultra')) return 3;
  if (code.includes('pro')) return 2;
  if (code.includes('basic')) return 1;
  return PLAN_TIER_RANKS[code] ?? 0;
};

export const getAccountEffectivePlanRank = (account: IgAccountItem): number => {
  const rawCode = String(account.plan_code || 'free').trim().toLowerCase();
  if (!rawCode || rawCode === 'free') return 0;

  if (account.expires_at) {
    const exp = new Date(account.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
      return 0;
    }
  }

  if (account.subscription_status && String(account.subscription_status).trim().toLowerCase() !== 'active') {
    return 0;
  }

  if (account.is_active === false && !account.expires_at) {
    return 0;
  }

  return getPlanRank(rawCode);
};

type AppliedCoupon = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
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
  targetAccountId?: string | null;
  onClose: () => void;
  onPaymentSuccess?: (planName: string) => void;
  onSyncComplete?: () => Promise<void>;
}

const loadRazorpay = async () => {
  if (typeof window === 'undefined') return;
  if ((window as any).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay.')));
      return;
    }
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
        className="h-9 w-9 flex-shrink-0 rounded-full object-cover border border-border/80 shadow-sm"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 text-white font-black text-xs shadow-sm">
      {initial}
    </div>
  );
};

const getAccountId = (acc: any): string => {
  return String(acc?.id || acc?.ig_user_id || acc?.$id || '');
};

const isAccountSelected = (account: IgAccountItem, selectedIds: Set<string>): boolean => {
  if (!account || !selectedIds || selectedIds.size === 0) return false;
  const primaryId = getAccountId(account);
  if (primaryId && selectedIds.has(primaryId)) return true;
  if (account.id && selectedIds.has(String(account.id))) return true;
  if (account.ig_user_id && selectedIds.has(String(account.ig_user_id))) return true;
  if ((account as any).$id && selectedIds.has(String((account as any).$id))) return true;
  return false;
};

export const PlanCheckoutModal: React.FC<PlanCheckoutModalProps> = ({
  isOpen,
  plans,
  currentPlan,
  initialPlanId,
  targetAccountId = null,
  defaultBillingCycle = 'monthly',
  currency = 'INR',
  countryCode = 'IN',
  authenticatedFetch,
  loadingPlanId = null,
  syncingPlan = false,
  igAccounts = [],
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
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponState, setCouponState] = useState<CouponState | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const pricingHeaders = useMemo(() => buildCountryHeaders(countryCode), [countryCode]);
  const selectedPlan = useMemo(
    () => findPricingPlan(eligiblePlans, selectedPlanId),
    [eligiblePlans, selectedPlanId]
  );

  const wasOpenRef = useRef(false);

  // Preload Razorpay SDK when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRazorpay().catch(() => {});
    }
  }, [isOpen]);

  // Keyboard accessibility (ESC to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isStartingCheckout && !isVerifyingPayment) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isStartingCheckout, isVerifyingPayment, onClose]);

  // Sync prop accounts whenever they update
  useEffect(() => {
    if (Array.isArray(igAccounts) && igAccounts.length > 0) {
      setLocalAccounts(igAccounts);
    }
  }, [igAccounts]);

  // Fetch accounts on modal open if none provided
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setSelectedPlanId(resolvedInitialPlanId);
      setBillingCycle(defaultBillingCycle);
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponState(null);

      if (!igAccounts || igAccounts.length === 0) {
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
              if (!cancelled && fetched.length > 0) {
                setLocalAccounts(fetched);
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
    }
  }, [isOpen, igAccounts, defaultBillingCycle, resolvedInitialPlanId, authenticatedFetch]);

  const targetPlanRank = useMemo(() => {
    return getPlanRank(selectedPlan?.plan_code || selectedPlan?.id || selectedPlanId);
  }, [selectedPlan, selectedPlanId]);

  // Only show accounts that have a lower subscription tier than the selected plan
  const eligibleAccounts = useMemo(() => {
    if (targetPlanRank === 0) return localAccounts;
    return localAccounts.filter((acc) => {
      const accRank = getAccountEffectivePlanRank(acc);
      return accRank < targetPlanRank;
    });
  }, [localAccounts, targetPlanRank]);

  // Auto-initialize & maintain selection: ensure at least 1 linked eligible account is selected
  useEffect(() => {
    if (!isOpen) return;

    setSelectedAccountIds((prev) => {
      const eligibleIds = new Set(
        eligibleAccounts.flatMap((acc) => [
          getAccountId(acc),
          String(acc.id || ''),
          String(acc.ig_user_id || ''),
          String((acc as any).$id || '')
        ]).filter(Boolean)
      );

      const cleaned = new Set<string>();
      for (const id of prev) {
        if (eligibleIds.has(id)) {
          cleaned.add(id);
        }
      }

      if (cleaned.size === 0 && eligibleAccounts.length > 0) {
        let matchedId = '';
        if (targetAccountId) {
          const found = eligibleAccounts.find((acc) => {
            const id = getAccountId(acc);
            return id === String(targetAccountId) || acc.id === targetAccountId || acc.ig_user_id === targetAccountId || (acc as any).$id === targetAccountId;
          });
          if (found) {
            matchedId = getAccountId(found);
          }
        }
        if (!matchedId) {
          matchedId = getAccountId(eligibleAccounts[0]);
        }
        if (matchedId) {
          cleaned.add(matchedId);
        }
      }

      return cleaned;
    });
  }, [isOpen, eligibleAccounts, targetAccountId]);

  const selectedConnectedAccounts = useMemo(() => {
    return eligibleAccounts.filter((acc) => isAccountSelected(acc, selectedAccountIds));
  }, [eligibleAccounts, selectedAccountIds]);

  const selectedConnectedCount = selectedConnectedAccounts.length;

  // Derived billable accounts count - only linked eligible accounts
  const accountsCount = useMemo(() => {
    return eligibleAccounts.length === 0 ? 0 : selectedConnectedCount;
  }, [eligibleAccounts.length, selectedConnectedCount]);

  // 100% Instant, Zero-Latency Real-Time Price Calculations
  const unitBasePrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return getPlanBilledTotal(selectedPlan, currency, billingCycle === 'yearly');
  }, [selectedPlan, currency, billingCycle]);

  const billedTotal = useMemo(() => {
    return unitBasePrice * accountsCount;
  }, [unitBasePrice, accountsCount]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon || billedTotal <= 0) return 0;
    if (appliedCoupon.type === 'percent') {
      return Math.round((billedTotal * Number(appliedCoupon.value || 0)) / 100);
    }
    return Math.min(billedTotal, Number(appliedCoupon.value || 0));
  }, [appliedCoupon, billedTotal]);

  const finalAmount = useMemo(() => {
    return Math.max(0, billedTotal - discountAmount);
  }, [billedTotal, discountAmount]);

  const toggleAccountSelection = useCallback((account: IgAccountItem) => {
    const accId = getAccountId(account);
    const altIds = [String(account.id || ''), String(account.ig_user_id || ''), String((account as any).$id || '')].filter(Boolean);

    setSelectedAccountIds((prev) => {
      const next = new Set<string>(prev);
      const isCurrentlySelected = Array.from(next).some((id) => id === accId || altIds.includes(id));

      if (isCurrentlySelected) {
        // If this is the only selected account, do not deselect it (must keep at least 1 selected)
        if (next.size <= 1) {
          return prev;
        }
        next.delete(accId);
        altIds.forEach((id) => next.delete(id));
      } else {
        next.add(accId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set<string>(eligibleAccounts.map((acc) => getAccountId(acc)).filter(Boolean));
    setSelectedAccountIds(allIds);
  }, [eligibleAccounts]);

  const handleDeselectAll = useCallback(() => {
    if (eligibleAccounts.length > 0) {
      setSelectedAccountIds(new Set<string>([getAccountId(eligibleAccounts[0])]));
    } else {
      setSelectedAccountIds(new Set<string>());
    }
  }, [eligibleAccounts]);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponState({
        valid: false,
        message: 'Please enter a coupon code.'
      });
      return;
    }
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
            coupon_code: code,
            accounts_count: accountsCount,
            selected_account_ids: Array.from(selectedAccountIds)
          })
        }
      );
      const payload = await response.json().catch(() => null);

      if (payload?.valid) {
        const couponData = payload?.coupon;
        setAppliedCoupon({
          code: couponData?.code || code,
          type: String(couponData?.type || '').toLowerCase() === 'percent' ? 'percent' : 'fixed',
          value: Number(couponData?.value || 0)
        });
        setCouponState({
          valid: true,
          message: couponData?.code ? `Coupon "${couponData.code}" applied!` : 'Coupon applied successfully!'
        });
        return;
      }

      setAppliedCoupon(null);
      setCouponState({
        valid: false,
        message: getCouponMessage(String(payload?.reason || 'invalid'))
      });
    } catch (error) {
      console.error('Coupon validation failed:', error);
      setAppliedCoupon(null);
      setCouponState({
        valid: false,
        message: 'Could not apply coupon right now.'
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponState(null);
  };

  const handleStartCheckout = async () => {
    if (!selectedPlan || accountsCount <= 0) return;

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
            coupon_code: appliedCoupon ? appliedCoupon.code : (couponCode.trim() || undefined),
            accounts_count: accountsCount,
            selected_account_ids: Array.from(selectedAccountIds)
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

      if (orderPayload?.pricing?.coupon?.code) {
        const couponData = orderPayload.pricing.coupon;
        setAppliedCoupon({
          code: couponData.code,
          type: String(couponData.type || '').toLowerCase() === 'percent' ? 'percent' : 'fixed',
          value: Number(couponData.value || 0)
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
              coupon_code: appliedCoupon ? appliedCoupon.code : (couponCode.trim() || undefined),
              payment_attempt_id: orderPayload?.payment_attempt_id || undefined,
              accounts_count: accountsCount,
              selected_account_ids: Array.from(selectedAccountIds)
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
                  coupon_code: appliedCoupon ? appliedCoupon.code : (couponCode.trim() || undefined),
                  payment_attempt_id: orderPayload?.payment_attempt_id || undefined,
                  accounts_count: accountsCount,
                  selected_account_ids: Array.from(selectedAccountIds)
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

  if (!isOpen) return null;

  const overlayRoot = typeof document !== 'undefined'
    ? (document.querySelector('[data-dashboard-section-overlay-root]') as HTMLElement | null)
    : null;
  const isSectionViewportOverlay = Boolean(overlayRoot);

  const modalContent = (
    <div
      className={cn(
        'animate-in fade-in duration-200',
        isSectionViewportOverlay
          ? 'pointer-events-auto absolute inset-0 z-[220] flex items-center justify-center bg-black/60 px-3 py-4 backdrop-blur-md sm:px-6'
          : 'fixed inset-0 z-[220] flex items-center justify-center bg-black/60 px-3 py-4 backdrop-blur-md sm:px-6'
      )}
    >
      <div
        className={cn(
          'relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border/80 bg-card shadow-[0_32px_100px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200',
          isSectionViewportOverlay ? 'max-h-[calc(100%-2rem)]' : 'max-h-[92vh]'
        )}
      >
        {isVerifyingPayment && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-card/90 backdrop-blur-md">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-base font-black text-foreground">Verifying your payment...</p>
            <p className="mt-1 text-xs text-muted-foreground">Please do not close or refresh this window.</p>
          </div>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isStartingCheckout || isVerifyingPayment}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/90 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left Column: Accounts & Plan Selector */}
          <div className="min-h-0 overflow-y-auto border-b border-border/80 p-4 sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
            <div className="max-w-2xl space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-3 w-3" /> Quick Billing
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Select Accounts & Plan</h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Pick the Instagram accounts to include in your subscription, or add extra unlinked slots.
                </p>
              </div>

              {/* Instagram Account Selector Section */}
              <div className="rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/70">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
                      <Instagram className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-foreground">Instagram Accounts</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedConnectedCount} of {eligibleAccounts.length} eligible {eligibleAccounts.length === 1 ? 'account' : 'accounts'} selected
                      </p>
                    </div>
                  </div>

                  {eligibleAccounts.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedConnectedCount < eligibleAccounts.length ? (
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-xs font-bold text-primary hover:underline transition px-1"
                        >
                          Select All
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline transition px-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Account Cards List */}
                <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                  {isLoadingAccounts ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading Instagram accounts...
                    </div>
                  ) : eligibleAccounts.length > 0 ? (
                    eligibleAccounts.map((account) => {
                      const id = getAccountId(account) || String(account.username || Math.random());
                      const isSelected = isAccountSelected(account, selectedAccountIds);
                      const currentPlanLabel = account.plan_name || (account.plan_code === 'basic' ? 'Basic Plan' : (account.plan_code === 'pro' ? 'Pro Plan' : (account.plan_code === 'ultra' ? 'Ultra Plan' : 'Free Plan')));
                      const isFree = !account.plan_code || account.plan_code === 'free';
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleAccountSelection(account)}
                          className={cn(
                            'group flex w-full items-center justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all active:scale-[0.99]',
                            isSelected
                              ? 'border-primary bg-primary/8 shadow-xs'
                              : 'border-border/70 bg-background/50 hover:border-border hover:bg-background/80'
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AccountAvatar
                              url={account.profile_picture_url}
                              username={account.username}
                              name={account.name}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                                  {account.username ? `@${account.username}` : account.name || 'Instagram Account'}
                                </p>
                                {account.plan_code && account.plan_code !== 'free' && (
                                  <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    {account.plan_name || account.plan_code}
                                  </span>
                                )}
                              </div>
                              {account.name && account.username && (
                                <p className="truncate text-[10px] sm:text-xs text-muted-foreground">{account.name}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className="hidden sm:inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Connected
                            </span>
                            <div className={cn('transition-transform duration-150', isSelected ? 'scale-105 text-primary' : 'text-muted-foreground/40 group-hover:text-muted-foreground/80')}>
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 fill-primary text-primary-foreground" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : localAccounts.length > 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
                      <Instagram className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                      <p className="text-xs sm:text-sm font-bold text-foreground">No accounts eligible for this plan</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        All your connected accounts already have an equal or higher active plan than {selectedPlan?.name || 'this plan'}.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
                      <Instagram className="mx-auto h-8 w-8 text-pink-500 mb-2" />
                      <p className="text-xs sm:text-sm font-bold text-foreground">No Instagram Accounts Connected</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Please connect your Instagram account first in Account Settings to purchase a subscription.
                      </p>
                    </div>
                  )}
                </div>

                {eligibleAccounts.length > 0 && (
                  <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>Selected Accounts:</span>
                    <span className="font-bold text-foreground">{accountsCount} {accountsCount === 1 ? 'Account' : 'Accounts'}</span>
                  </div>
                )}
              </div>

              {/* Billing Cycle Switch (Monthly / Yearly) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 p-2 sm:p-2.5">
                <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all',
                      billingCycle === 'monthly'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all',
                      billingCycle === 'yearly'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Yearly
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground pr-1">
                  {billingCycle === 'yearly' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <Tag className="h-3.5 w-3.5" /> Save up to 20% on yearly plans
                    </span>
                  ) : (
                    <span>Flexible monthly &bull; cancel anytime</span>
                  )}
                </div>
              </div>

              {/* Plan Cards List */}
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Available Plans</p>
                <div className="grid gap-3">
                  {eligiblePlans.map((entry) => {
                    const isSelected = entry.id === selectedPlanId;
                    const unitPrice = getPlanBilledTotal(entry, currency, billingCycle === 'yearly');
                    const totalPlanPrice = unitPrice * Math.max(1, accountsCount);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedPlanId(entry.id)}
                        className={cn(
                          `rounded-2xl border p-4 text-left ${FAST_TRANSITION} transition-all active:scale-[0.99]`,
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                            : 'border-border/80 bg-background/50 hover:border-border hover:bg-background/80'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-foreground">{entry.name}</h3>
                              {entry.is_popular && (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-primary-foreground">
                                  Popular
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatMoney(unitPrice, currency)} / account / {billingCycle === 'yearly' ? 'yr' : 'mo'}
                              <span className="ml-2 font-bold text-foreground">
                                (Total: {formatMoney(totalPlanPrice, currency)} for {Math.max(1, accountsCount)} {accountsCount === 1 ? 'account' : 'accounts'})
                              </span>
                            </p>
                          </div>
                          <div
                            className={cn(
                              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition',
                              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                        </div>

                        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                          {entry.features.slice(0, 4).map((feature, index) => (
                            <div key={`${entry.id}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
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
          </div>

          {/* Right Column: Order Summary */}
          <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 sm:p-6 lg:p-7 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Order Summary</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <h3 className="text-xl font-black text-foreground">{selectedPlan?.name || 'Select a plan'}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-foreground">
                    {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {accountsCount > 0 ? `Billed for ${accountsCount} ${accountsCount === 1 ? 'Instagram Account' : 'Instagram Accounts'}` : 'No accounts connected'}
                </p>

                {/* Covered Accounts Summary Pill */}
                <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] font-bold text-foreground mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" /> Covered Accounts
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">{accountsCount} Total</span>
                  </div>

                  {selectedConnectedAccounts.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedConnectedAccounts.map((acc) => (
                        <div key={acc.id} className="flex items-center gap-2 text-xs text-foreground font-medium">
                          <AccountAvatar url={acc.profile_picture_url} username={acc.username} name={acc.name} />
                          <span className="truncate">@{acc.username || acc.name || 'Instagram Account'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-0.5">
                      No Instagram accounts selected
                    </div>
                  )}
                </div>

                {/* Real-time Zero-Latency Price Breakdown */}
                <div className="mt-4 space-y-2.5 rounded-xl border border-border/70 bg-background/60 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Accounts Count</span>
                    <span className="font-bold text-foreground">{accountsCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Rate / account</span>
                    <span className="font-bold text-foreground">{formatMoney(unitBasePrice, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-bold text-foreground">{formatMoney(billedTotal, currency)}</span>
                  </div>
                  {appliedCoupon && discountAmount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <Tag className="h-3 w-3" /> Coupon Discount ({appliedCoupon.code})
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        - {formatMoney(discountAmount, currency)}
                      </span>
                    </div>
                  )}
                  <div className="h-px bg-border/80" />
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs font-bold text-foreground">Total Payable</span>
                    <span className="text-2xl font-black text-foreground tracking-tight">{formatMoney(finalAmount, currency)}</span>
                  </div>
                </div>

                {/* Coupon Code Section */}
                <div className="mt-4">
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Have a promo coupon?
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-emerald-500" />
                        <div>
                          <span className="font-black tracking-wider uppercase">{appliedCoupon.code}</span>
                          <span className="ml-2 font-medium opacity-90">
                            ({appliedCoupon.type === 'percent' ? `${appliedCoupon.value}% off` : `${formatMoney(appliedCoupon.value, currency)} off`})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="rounded-lg p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
                        title="Remove coupon"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponState(null);
                        }}
                        placeholder="ENTER CODE"
                        className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-xs font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-muted px-4 text-xs font-bold text-foreground transition hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isApplyingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                  )}

                  {couponState && !appliedCoupon && (
                    <p className={cn('mt-1.5 text-xs font-medium', couponState.valid ? 'text-emerald-500' : 'text-destructive')}>
                      {couponState.message}
                    </p>
                  )}
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleStartCheckout}
                  disabled={!selectedPlan || accountsCount <= 0 || eligibleAccounts.length === 0 || isStartingCheckout || syncingPlan || loadingPlanId === selectedPlan?.id}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-foreground px-5 text-sm font-black text-background transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                >
                  {isStartingCheckout || syncingPlan || loadingPlanId === selectedPlan?.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : localAccounts.length === 0 ? (
                    'Connect an Instagram Account First'
                  ) : eligibleAccounts.length === 0 ? (
                    'No Accounts Eligible For This Plan'
                  ) : accountsCount <= 0 ? (
                    'Select an Instagram Account'
                  ) : finalAmount <= 0 ? (
                    'Activate Plan'
                  ) : (
                    `Pay ${formatMoney(finalAmount, currency)}`
                  )}
                </button>
              </div>
            </div>

            {/* Trust & Security Badges */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>256-Bit SSL Encrypted &bull; Razorpay Certified &bull; Instant Activation</span>
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
