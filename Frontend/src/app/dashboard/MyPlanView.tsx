import React, { useEffect, useMemo, useState } from 'react';
import { Zap, Check, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface PlanDetails {
  name: string;
  features: Array<string | { name?: string; title?: string } | null>;
  price_monthly_inr: number;
  price_monthly_usd: number;
}

interface UserPlan {
  plan_id: string;
  status: string;
  expires: string | null;
  details: PlanDetails | null;
}

interface Plan {
  id: string;
  name: string;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  features: Array<string | { name?: string; title?: string } | null>;
  is_popular?: boolean;
  button_text?: string;
  yearly_bonus?: string;
}

const MyPlanView: React.FC = () => {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [isIndianUser, setIsIndianUser] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const { authenticatedFetch } = useAuth();

  const normalizeFeatures = (features: Plan['features'] | any) => {
    if (Array.isArray(features)) return features;
    if (features && typeof features === 'object') return [features];
    if (typeof features === 'string') return [features];
    return [];
  };

  const normalizePlan = (raw: any): Plan => ({
    id: String(raw?.id ?? raw?.$id ?? raw?.plan_id ?? ''),
    name: String(raw?.name ?? raw?.title ?? 'Plan'),
    price_monthly_inr: Number(raw?.price_monthly_inr ?? raw?.monthly_inr ?? 0),
    price_yearly_inr: Number(raw?.price_yearly_inr ?? raw?.yearly_inr ?? 0),
    price_monthly_usd: Number(raw?.price_monthly_usd ?? raw?.monthly_usd ?? 0),
    price_yearly_usd: Number(raw?.price_yearly_usd ?? raw?.yearly_usd ?? 0),
    features: normalizeFeatures(raw?.features ?? raw?.benefits ?? raw?.feature_list),
    is_popular: Boolean(raw?.is_popular ?? raw?.popular),
    button_text: raw?.button_text ?? raw?.cta_text ?? undefined,
    yearly_bonus: raw?.yearly_bonus ?? raw?.bonus ?? undefined,
  });

  useEffect(() => {
    const fetchMyPlan = async () => {
      try {
        const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`);
        if (!response.ok) {
          setPlan(null);
          return;
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setPlan(null);
          return;
        }
        const data = await response.json();
        setPlan(data);
      } catch (error) {
        console.error('Error fetching plan:', error);
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMyPlan();
  }, [authenticatedFetch]);

  const fetchPlans = React.useCallback(async () => {
    setPlansError(null);
    setPlansLoading(true);
    try {
      const geoRes = await fetch('https://api.country.is/');
      const geoData = await geoRes.json();
      if (geoData?.country === 'IN') {
        setIsIndianUser(true);
        setCurrency('INR');
      }

      const plansRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`);
      if (!plansRes.ok) {
        setPlans([]);
        setPlansError('Could not load plans. Please try again.');
        return;
      }
      const contentType = plansRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setPlans([]);
        setPlansError('Plans response was not JSON. Please try again.');
        return;
      }
        const plansData = await plansRes.json();
        const planList = Array.isArray(plansData)
          ? plansData
          : Array.isArray(plansData?.plans)
            ? plansData.plans
            : Array.isArray(plansData?.documents)
              ? plansData.documents
              : [];
        const normalizedPlans = planList.map((p: any) => normalizePlan(p));
        setPlans(normalizedPlans);
        if (normalizedPlans.length === 0) {
          setPlansError('No plans are available right now.');
        }
    } catch (error) {
      console.error('Error fetching plans:', error);
      setPlans([]);
      setPlansError('Failed to load plans. Please try again.');
    } finally {
      setPlansLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const isExpired = plan?.status === 'expired' || (plan?.expires && new Date(plan.expires) < new Date());
  const currentPlanName = plan?.details?.name || 'Free';
  const formattedPlans = useMemo(() => {
    if (!Array.isArray(plans)) return [] as Array<Plan & { price: number }>;
    return plans.map((p) => {
      const price = currency === 'INR'
        ? (isYearly ? p.price_yearly_inr : p.price_monthly_inr)
        : (isYearly ? p.price_yearly_usd : p.price_monthly_usd);
      return { ...p, price } as Plan & { price: number };
    });
  }, [plans, currency, isYearly]);
  const upgradeCandidate = formattedPlans.find((p) => p.name !== currentPlanName);
  const canUpgrade = Boolean(upgradeCandidate) && !plansLoading;

  if (loading) return <LoadingSpinner text="Loading Plan Details..." />;

  const formatFeature = (feature: string | { name?: string; title?: string } | null) => {
    if (typeof feature === 'string') {
      const cleaned = feature.replace(/^[\[\(\{\"\s]+|[\]\)\}\"\s]+$/g, '').trim();
      return cleaned || 'Feature';
    }
    if (feature && typeof feature === 'object') return feature.name || feature.title || 'Feature';
    return 'Feature';
  };

  const toFeatureList = (raw: unknown) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const cleanedRaw = trimmed.replace(/^\"|\"$/g, '').trim();
      if (cleanedRaw.startsWith('[') && cleanedRaw.endsWith(']')) {
        try {
          const parsed = JSON.parse(cleanedRaw);
          return Array.isArray(parsed) ? parsed : [cleanedRaw];
        } catch {
          const inner = cleanedRaw.slice(1, -1);
          const parts = inner
            .split('","')
            .join(',')
            .split(',')
            .map((p) => p.replace(/^\"|\"$/g, '').trim())
            .filter(Boolean);
          return parts.length ? parts : [cleanedRaw];
        }
      }
      if (cleanedRaw.includes(',')) {
        const parts = cleanedRaw
          .split(',')
          .map((p) => p.replace(/^\"|\"$/g, '').trim())
          .filter(Boolean);
        return parts.length ? parts : [cleanedRaw];
      }
      return [cleanedRaw];
    }
    if (raw && typeof raw === 'object') return [raw];
    return [];
  };

  const formatPrice = (value: number) => {
    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const handleCurrencyToggle = () => {
    setCurrency((c) => (c === 'INR' ? 'USD' : 'INR'));
  };

  const handleSubscribe = async (selectedPlan: Plan) => {
    if (!selectedPlan || selectedPlan.name === currentPlanName) return;
    setPaymentLoading(selectedPlan.id);
    try {
      const amount = currency === 'INR'
        ? (isYearly ? selectedPlan.price_yearly_inr : selectedPlan.price_monthly_inr)
        : (isYearly ? selectedPlan.price_yearly_usd : selectedPlan.price_monthly_usd);

      const orderResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount * 100,
          currency: currency
        }),
      });

      if (!orderResponse.ok) throw new Error('Failed to create order');
      const orderData = await orderResponse.json();

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SEjUlisckzqoqx',
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'DM Panda',
          description: `Upgrade to ${selectedPlan.name} (${isYearly ? 'Yearly' : 'Monthly'})`,
          order_id: orderData.id,
          handler: async (response: any) => {
            const verifyResponse = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: selectedPlan.name,
                is_yearly: isYearly
              }),
            });

            if (verifyResponse.ok) {
              window.location.reload();
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          },
          prefill: {
            name: 'User',
            email: 'user@example.com',
          },
          theme: { color: '#000000' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setPaymentLoading(null);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Subscription</h1>
          <p className="text-muted-foreground">Manage your plan and billing information</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${isExpired ? 'bg-destructive-muted/40 text-destructive' : 'bg-success-muted/60 text-success'
          }`}>
          <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-destructive' : 'bg-success'}`} />
          {isExpired ? 'Expired' : 'Active'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Current Plan Card */}
        <div className="md:col-span-2 bg-card rounded-3xl p-8 border border-border shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap size={120} className="text-primary" />
          </div>

          <div className="relative">
            <span className="text-primary font-bold uppercase tracking-wider text-sm">Current Plan</span>
            <h2 className="text-4xl font-black mt-2 mb-6 text-foreground flex items-center gap-3">
              {currentPlanName}
              <Zap className="fill-primary text-primary" size={28} />
            </h2>

            <div className="flex flex-wrap gap-4 mb-8">
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/40 px-4 py-2 rounded-xl border border-border">
                <Calendar size={18} />
                <span className="text-sm">
                  {plan?.expires ? `Renews on ${new Date(plan.expires).toLocaleDateString()}` : 'Never expires'}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="font-bold text-foreground">Plan Features:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {toFeatureList(plan?.details?.features).map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success-muted/60 flex items-center justify-center text-success flex-shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    {formatFeature(feature)}
                  </div>
                ))}
              </div>
            </div>

            <button
              className={`px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${canUpgrade ? 'bg-foreground text-background hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              onClick={() => {
                if (upgradeCandidate) handleSubscribe(upgradeCandidate);
              }}
              disabled={!canUpgrade}
            >
              {canUpgrade ? 'Upgrade Plan' : 'No upgrades available'}
            </button>
          </div>
        </div>

        {/* Status/Actions Card */}
        <div className="space-y-6">
          <div className="bg-primary/10 rounded-3xl p-6 border border-primary/20">
            <div className="flex items-center gap-3 mb-4 text-primary">
              <AlertCircle size={20} />
              <h4 className="font-bold">Need more?</h4>
            </div>
            <p className="text-sm text-primary/80 mb-4">
              Upgrade to a higher tier to unlock more accounts and automated actions for your growth.
            </p>
          </div>

          <div className="bg-foreground text-background rounded-3xl p-6 shadow-xl">
            <h4 className="font-bold mb-2">Usage Summary</h4>
            <div className="space-y-4 mt-6">
              <div>
                <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                  <span>Daily Actions</span>
                  <span>24/100</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[24%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                  <span>Accounts Connected</span>
                  <span>1/3</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success w-[33%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-foreground">Available Plans</h2>
            <p className="text-muted-foreground">Choose a plan that fits your growth goals.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-muted p-1 rounded-2xl inline-flex">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isYearly ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isYearly ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly
              </button>
            </div>
            {isIndianUser && (
              <button
                onClick={handleCurrencyToggle}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                {currency === 'INR' ? 'INR' : 'USD'}
              </button>
            )}
          </div>
        </div>

        {plansLoading ? (
          <LoadingSpinner text="Loading Plans..." />
        ) : plansError ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <span>{plansError}</span>
            <button
              className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition"
              onClick={fetchPlans}
            >
              Retry
            </button>
          </div>
        ) : formattedPlans.length === 0 ? (
          <div className="text-sm text-muted-foreground">No plans available right now.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {formattedPlans.map((p) => {
              const isCurrent = p.name === currentPlanName;
              const isPopular = !!p.is_popular;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 ${
                    isPopular
                      ? 'bg-card border border-primary/40 shadow-xl scale-[1.02] ring-1 ring-primary/15 text-foreground'
                      : 'bg-card border border-border hover:shadow-xl hover:border-border/60 text-foreground'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
                      POPULAR
                    </div>
                  )}

                  <h3 className="text-2xl font-bold mb-2">{p.name}</h3>
                  <div className="mb-6 h-20 flex flex-col justify-center">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        {formatPrice(Number((p as any).price || 0))}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    {isYearly && p.yearly_bonus && (
                      <p className="text-success text-sm font-medium mt-1">{p.yearly_bonus}</p>
                    )}
                  </div>

                  <div className="space-y-4 flex-grow">
                    {toFeatureList(p.features).slice(0, 8).map((f, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5 text-success">
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <span className="text-muted-foreground">
                          {formatFeature(f)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={`mt-8 pt-6 border-t ${isPopular ? 'border-primary/30' : 'border-border'}`}>
                    <button
                      className={`w-full py-4 h-14 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center shadow-xl ${
                        isCurrent
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : isPopular
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-foreground text-background hover:opacity-90'
                      }`}
                      disabled={isCurrent || paymentLoading === p.id}
                      onClick={() => handleSubscribe(p)}
                    >
                      {isCurrent ? 'Current Plan' : paymentLoading === p.id ? 'Processing...' : (p.button_text || 'Choose Plan')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPlanView;
