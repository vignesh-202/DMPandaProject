import React, { useEffect, useMemo, useState } from 'react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import { PricingComparisonItem, PricingPlan, formatMoney, getPlanBigPrice, normalizePricingPayload } from '../../lib/pricing';

let pricingPageBootstrapPromise: Promise<{
  geo: Awaited<ReturnType<typeof detectGeoCurrency>>;
  plans: PricingPlan[];
}> | null = null;

const PricingPage: React.FC = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [isIndianUser, setIsIndianUser] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (!pricingPageBootstrapPromise) {
          pricingPageBootstrapPromise = (async () => {
            const geo = await detectGeoCurrency();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`, {
              headers: buildCountryHeaders(geo.countryCode)
            });
            if (!response.ok) {
              throw new Error(`Failed to load pricing (${response.status})`);
            }
            const data = await response.json().catch(() => ({}));
            return {
              geo,
              plans: normalizePricingPayload(data)
            };
          })().catch((error) => {
            pricingPageBootstrapPromise = null;
            throw error;
          });
        }

        const { geo, plans: normalizedPlans } = await pricingPageBootstrapPromise;
        if (cancelled) return;

        setIsIndianUser(geo.isIndianUser);
        setCurrency(geo.defaultCurrency);
        setPlans(normalizedPlans);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load pricing page:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAllCards = () => setAllExpanded(!allExpanded);

  const comparisonRows = useMemo(() => {
    const rows = new Map<string, { label: string; values: Record<string, unknown> }>();
    plans.forEach((plan) => {
      plan.comparison.forEach((item: PricingComparisonItem) => {
        const key = String(item.key || item.label || '').trim();
        const label = String(item.label || item.key || '').trim();
        if (!key || !label) return;
        const existing = rows.get(key) || { label, values: {} };
        existing.values[plan.plan_code || plan.id] = item.value;
        rows.set(key, existing);
      });
    });
    return Array.from(rows.entries()).map(([key, row]) => ({ key, ...row }));
  }, [plans]);

  return (
    <section className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 font-sans pt-28 sm:pt-32 pb-16 sm:pb-24 transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 tracking-tight">Flexible Pricing for Everyone</h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400">Choose the plan that's right for you. Start free, upgrade as you grow.</p>
        </div>

        {/* Toggles */}
        <div className="flex flex-col items-center mb-12 sm:mb-16 space-y-6 sm:space-y-8">
          <div className="bg-gray-100 dark:bg-white/[0.06] p-1 rounded-2xl inline-flex relative">
            <button
              onClick={() => setIsYearly(false)}
              className={`relative z-10 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-300 ${!isYearly ? 'bg-white dark:bg-white/[0.1] shadow-md text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`relative z-10 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${isYearly ? 'bg-white dark:bg-white/[0.1] shadow-md text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Yearly
              <span className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded-lg uppercase tracking-wider">Save</span>
            </button>
          </div>

          {isIndianUser && (
            <div className="flex items-center gap-4 text-sm font-medium bg-gray-50 dark:bg-white/[0.04] px-4 py-2 rounded-lg border border-gray-200 dark:border-white/[0.08]">
              <span className={`${currency === 'INR' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>INR</span>
              <button
                onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}
                className={`w-12 h-6 rounded-xl p-1 transition-colors duration-300 ${currency === 'INR' ? 'bg-gray-900 dark:bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${currency === 'INR' ? 'translate-x-0' : 'translate-x-6'}`} />
              </button>
              <span className={`${currency === 'USD' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>USD</span>
            </div>
          )}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-500 py-12">Loading pricing...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-16 sm:mb-24">
            {plans.map((plan, index) => {
              const visibleFeatures = allExpanded ? plan.features : plan.features.slice(0, 6);
              const hasMoreFeatures = plan.features.length > 6;
              const isPopular = plan.is_popular;
              const price = getPlanBigPrice(plan, currency, isYearly);

              return (
                <div
                  key={index}
                  className={`relative flex flex-col p-6 sm:p-8 rounded-3xl transition-all duration-300 ${isPopular
                    ? 'bg-gray-900 dark:bg-gradient-to-b dark:from-purple-500/20 dark:to-blue-500/10 text-white shadow-2xl scale-[1.02] sm:scale-105 z-10 ring-1 ring-gray-800 dark:ring-purple-500/20'
                    : 'bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:shadow-xl hover:border-gray-300 dark:hover:border-white/[0.12] text-gray-900 dark:text-gray-100'
                    }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-2xl">
                      POPULAR
                    </div>
                  )}

                  <h3 className="text-xl sm:text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6 h-20 flex flex-col justify-center">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold">{formatMoney(price, currency)}</span>
                      <span className={`text-sm ${isPopular ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>/month</span>
                    </div>
                    {isYearly && plan.yearly_bonus && (
                      <p className="text-green-500 dark:text-green-400 text-sm font-medium mt-1">{plan.yearly_bonus}</p>
                    )}
                  </div>

                  <div className="space-y-3 sm:space-y-4 flex-grow">
                    {visibleFeatures.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <div className={`mt-0.5 ${isPopular ? 'text-green-400' : 'text-green-600 dark:text-green-400'}`}>
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {hasMoreFeatures && (
                    <button
                      onClick={toggleAllCards}
                      className={`mt-6 mb-4 flex items-center justify-center gap-2 text-sm font-medium hover:underline ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      {allExpanded ? (
                        <>Show Less <ChevronUp size={14} /></>
                      ) : (
                        <>View all features <ChevronDown size={14} /></>
                      )}
                    </button>
                  )}

                  <div className={`mt-8 pt-6 border-t ${isPopular ? 'border-gray-700 dark:border-white/[0.1]' : 'border-gray-100 dark:border-white/[0.06]'}`}>
                    <AuthRedirectButton
                      className={`w-full py-3.5 sm:py-4 h-12 sm:h-14 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center shadow-lg ${isPopular
                        ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-white/5'
                        : 'bg-gray-900 dark:bg-white/[0.1] text-white hover:bg-gray-800 dark:hover:bg-white/[0.15] shadow-black/10'
                        }`}
                    >
                      {plan.button_text}
                    </AuthRedirectButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Comparison Table */}
        {comparisonRows.length > 0 && (
          <div className="mt-16 sm:mt-32">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 sm:mb-16 text-gray-900 dark:text-white">Compare features</h2>
            <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/[0.08] shadow-xl">
              <table className="w-full text-left bg-white dark:bg-white/[0.02]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/[0.08]">
                    <th className="p-4 sm:p-6 font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-50 dark:bg-neutral-900 text-sm">Features</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="p-4 sm:p-6 font-bold text-gray-900 dark:text-white text-center text-sm">{plan.name.replace(' Plan', '')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {comparisonRows.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 sm:p-6 font-medium text-gray-900 dark:text-gray-200 sticky left-0 bg-white dark:bg-neutral-950 hover:bg-gray-50 dark:hover:bg-white/[0.02] text-sm">{row.label}</td>
                      {plans.map((plan) => {
                        const value = row.values[plan.plan_code || plan.id];
                        return (
                          <td key={`${row.key}-${plan.id}`} className="p-4 sm:p-6 text-gray-600 dark:text-gray-400 text-center text-sm">
                            {typeof value === 'boolean'
                              ? (value ? <Check className="mx-auto text-green-500" size={20} /> : <X className="mx-auto text-gray-300 dark:text-gray-600" size={20} />)
                              : (value == null || value === '' ? '—' : String(value))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PricingPage;
