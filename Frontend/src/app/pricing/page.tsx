import React, { useEffect, useMemo, useState } from 'react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import InfoPopover from '../../components/ui/InfoPopover';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import {
  PricingPlan,
  buildPlanLimitItems,
  buildPricingComparisonRows,
  formatMoney,
  getPlanBigPrice,
  getPlanBilledTotal,
  normalizePricingPayload
} from '../../lib/pricing';

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

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAllCards = () => setAllExpanded(!allExpanded);

  const comparisonRows = useMemo(() => buildPricingComparisonRows(plans), [plans]);

  return (
    <section className="min-h-screen bg-white text-gray-900 transition-colors duration-500 dark:bg-neutral-950 dark:text-gray-100 font-sans pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:mb-6 sm:text-4xl lg:text-5xl">
            Flexible Pricing for Everyone
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 sm:text-lg lg:text-xl">
            Choose the plan that&apos;s right for you. Start free, upgrade as you grow.
          </p>
        </div>

        <div className="mb-12 flex flex-col items-center space-y-6 sm:mb-16 sm:space-y-8">
          <div className="relative inline-flex rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
            <button
              onClick={() => setIsYearly(false)}
              className={`relative z-10 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:px-8 sm:py-3 ${
                !isYearly
                  ? 'bg-white text-gray-900 shadow-md dark:bg-white/[0.1] dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`relative z-10 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:px-8 sm:py-3 ${
                isYearly
                  ? 'bg-white text-gray-900 shadow-md dark:bg-white/[0.1] dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Yearly
              <span className="rounded-lg bg-green-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-green-700 dark:bg-green-500/20 dark:text-green-400">
                Save
              </span>
            </button>
          </div>

          {isIndianUser && (
            <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium dark:border-white/[0.08] dark:bg-white/[0.04]">
              <span className={currency === 'INR' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>INR</span>
              <button
                onClick={() => setCurrency(currency === 'INR' ? 'USD' : 'INR')}
                className={`h-6 w-12 rounded-xl p-1 transition-colors duration-300 ${
                  currency === 'INR' ? 'bg-gray-900 dark:bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                    currency === 'INR' ? 'translate-x-0' : 'translate-x-6'
                  }`}
                />
              </button>
              <span className={currency === 'USD' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>USD</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-500">Loading pricing...</div>
        ) : (
          <div className="mb-16 grid grid-cols-1 gap-4 sm:mb-24 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-8">
            {plans.map((plan) => {
              const allFeatures = plan.feature_items
                ? plan.feature_items.map((item) => ({ key: item.key || item.label, label: item.label || item.key, enabled: item.enabled }))
                : plan.features.map((f) => ({ key: f, label: f, enabled: true }));
              const visibleFeatures = allExpanded ? allFeatures : allFeatures.slice(0, 6);
              const hasMoreFeatures = allFeatures.length > 6;
              const isPopular = plan.is_popular;
              const price = getPlanBigPrice(plan, currency, isYearly);
              const billedTotal = getPlanBilledTotal(plan, currency, isYearly);
              const planLimits = buildPlanLimitItems(plan);

              return (
                <div
                  key={plan.id || plan.plan_code}
                  className={`relative flex flex-col rounded-3xl p-6 transition-all duration-300 sm:p-8 ${
                    isPopular
                      ? 'z-10 scale-[1.02] bg-gray-900 text-white shadow-2xl ring-1 ring-gray-800 sm:scale-105 dark:bg-gradient-to-b dark:from-purple-500/20 dark:to-blue-500/10 dark:ring-purple-500/20'
                      : 'border border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-xl dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100 dark:hover:border-white/[0.12]'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute right-0 top-0 rounded-bl-xl rounded-tr-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1.5 text-xs font-bold text-white">
                      POPULAR
                    </div>
                  )}

                  <h3 className="mb-2 text-xl font-bold sm:text-2xl">{plan.name}</h3>
                  <div className="mb-6 flex h-auto min-h-20 flex-col justify-center">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold sm:text-4xl">{formatMoney(price, currency)}</span>
                      <span className={`text-sm ${isPopular ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>/month</span>
                    </div>
                    {isYearly && plan.yearly_bonus && (
                      <p className="mt-1 text-sm font-medium text-green-500 dark:text-green-400">{plan.yearly_bonus}</p>
                    )}
                    <p className={`mt-2 text-xs ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isYearly
                        ? `Billed yearly at ${formatMoney(billedTotal, currency)} for 364 days.`
                        : `Billed every 30 days at ${formatMoney(billedTotal, currency)}.`}
                    </p>
                  </div>

                  <div
                    className={`mb-6 rounded-2xl border p-4 ${
                      isPopular
                        ? 'border-white/10 bg-white/5'
                        : 'border-gray-200 bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        Plan limits
                      </p>
                      <InfoPopover
                        title="Plan limits"
                        description="These limits apply individually to each linked Instagram account, not as one shared limit across the whole user."
                        formula="Every linked Instagram account gets its own hourly, daily, and monthly usage window."
                        notes={[
                          'If a user links two Instagram accounts, both accounts receive their own plan limits.',
                          'Usage is tracked separately for each linked Instagram account.'
                        ]}
                        className="shrink-0"
                      />
                    </div>
                    <div className="mt-4 space-y-3">
                      {planLimits.map((item) => (
                        <div key={`${plan.id}-${item.label}`} className="flex items-center justify-between gap-4 text-sm">
                          <span className={isPopular ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}>{item.label}</span>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-grow space-y-3 sm:space-y-4">
                    {visibleFeatures.map((feature) => (
                      <div key={`${plan.id || plan.plan_code}-${feature.key}`} className={`flex items-start gap-3 text-sm ${!feature.enabled ? 'opacity-50' : ''}`}>
                        <div className={`mt-0.5 ${feature.enabled ? (isPopular ? 'text-green-400' : 'text-green-600 dark:text-green-400') : 'text-gray-400'}`}>
                          {feature.enabled ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                        </div>
                        <span className={feature.enabled ? '' : 'line-through decoration-gray-400'}>{feature.label}</span>
                      </div>
                    ))}
                  </div>

                  {hasMoreFeatures && (
                    <button
                      onClick={toggleAllCards}
                      className={`mb-4 mt-6 flex items-center justify-center gap-2 text-sm font-medium hover:underline ${
                        isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {allExpanded ? (
                        <>
                          Show Less <ChevronUp size={14} />
                        </>
                      ) : (
                        <>
                          View all features <ChevronDown size={14} />
                        </>
                      )}
                    </button>
                  )}

                  <div className={`mt-8 border-t pt-6 ${isPopular ? 'border-gray-700 dark:border-white/[0.1]' : 'border-gray-100 dark:border-white/[0.06]'}`}>
                    <AuthRedirectButton
                      className={`flex h-12 w-full items-center justify-center rounded-xl py-3.5 text-xs font-black uppercase tracking-[0.2em] shadow-lg transition-all duration-300 sm:h-14 sm:py-4 ${
                        isPopular
                          ? 'bg-white text-gray-900 shadow-white/5 hover:bg-gray-100'
                          : 'bg-gray-900 text-white shadow-black/10 hover:bg-gray-800 dark:bg-white/[0.1] dark:hover:bg-white/[0.15]'
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

        {comparisonRows.length > 0 && (
          <div className="mt-16 sm:mt-32">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white sm:mb-16 sm:text-4xl">
              Compare features
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-xl dark:border-white/[0.08] sm:rounded-3xl">
              <table className="w-full bg-white text-left dark:bg-white/[0.02]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <th className="sticky left-0 bg-gray-50 p-4 text-sm font-bold text-gray-900 dark:bg-neutral-900 dark:text-white sm:p-6">
                      Features
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="p-4 text-center text-sm font-bold text-gray-900 dark:text-white sm:p-6">
                        {plan.name.replace(' Plan', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {comparisonRows.map((row) => (
                    <tr key={`comp-row-${row.key}`} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="sticky left-0 bg-white p-4 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:bg-neutral-950 dark:text-gray-200 dark:hover:bg-white/[0.02] sm:p-6">
                        {row.label}
                      </td>
                      {plans.map((plan, planIdx) => {
                        const value = row.values[plan.plan_code || plan.id];
                        return (
                          <td key={`comp-cell-${row.key}-${planIdx}`} className="p-4 text-center text-sm text-gray-600 dark:text-gray-400 sm:p-6">
                            {typeof value === 'boolean'
                              ? (value ? <Check className="mx-auto text-green-500" size={20} /> : <X className="mx-auto text-gray-300 dark:text-gray-600" size={20} />)
                              : (value == null || value === '' ? '-' : String(value))}
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
