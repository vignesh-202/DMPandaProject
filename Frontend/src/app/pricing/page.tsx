import React, { useEffect, useMemo, useState } from 'react';
import AuthRedirectButton from '../../components/ui/AuthRedirectButton';
import { ChevronDown, ChevronUp, Check, X, Sparkles, Zap, Gift } from 'lucide-react';
import InfoPopover from '../../components/ui/InfoPopover';
import VVDealsTopTeaser from '../../components/ui/VVDealsTopTeaser';
import VVDealsOfferSection from '../../components/ui/VVDealsOfferSection';
import { buildCountryHeaders, detectGeoCurrency } from '../../lib/geoCurrency';
import {
  PricingPlan,
  buildPlanLimitItems,
  buildPricingComparisonRows,
  formatMoney,
  normalizePricingPayload
} from '../../lib/pricing';

let pricingPageBootstrapPromise: Promise<{
  geo: Awaited<ReturnType<typeof detectGeoCurrency>>;
  plans: PricingPlan[];
}> | null = null;

import { useSEO } from '../../hooks/useSEO';

const PricingPage: React.FC = () => {
  useSEO({
    title: 'Pricing Plans | DM Panda - Flexible Instagram Automation',
    description: 'Find the best pricing plan for automating your Instagram DMs. Start free, upgrade as you grow. Safe, certified, and compliant pricing.',
    keywords: 'dm panda pricing, instagram dm bot pricing, cheap instagram dm automations, instagram auto reply cost',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': 'DM Panda Instagram Automation Subscription',
      'description': 'Certified Instagram direct message, comment, share, and story automation service.',
      'image': 'https://dmpanda.com/images/logo.png',
      'offers': {
        '@type': 'AggregateOffer',
        'priceCurrency': 'INR',
        'lowPrice': '0.00',
        'highPrice': '499.00',
        'offerCount': '4'
      }
    }
  });

  const [isYearly, setIsYearly] = useState(true);
  const currency = 'INR';
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
            const response = await fetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/pricing`, {
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

        const { plans: normalizedPlans } = await pricingPageBootstrapPromise;
        if (cancelled) return;

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
        
        {/* Header Section */}
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-500/20">
            <Sparkles size={14} />
            <span>Simple, Transparent Pricing</span>
          </div>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:mb-6 sm:text-4xl lg:text-5xl">
            Flexible Plans for Every Creator
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400 sm:text-lg lg:text-xl leading-relaxed">
            Choose the plan that fits your growth. Start completely free and upgrade per account as your audience expands.
          </p>
        </div>

        {/* Monthly / Yearly Toggle */}
        <div className="mb-12 flex justify-center sm:mb-16">
          <div className="relative inline-flex items-center rounded-2xl bg-gray-100 p-1.5 shadow-inner dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`relative z-10 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:px-8 sm:py-3 ${
                !isYearly
                  ? 'bg-white text-gray-900 shadow-md dark:bg-white/[0.12] dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`relative z-10 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 sm:px-8 sm:py-3 ${
                isYearly
                  ? 'bg-white text-gray-900 shadow-md dark:bg-white/[0.12] dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <span>Yearly</span>
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Save 20%+
              </span>
            </button>
          </div>
        </div>

        {/* VVDeals Partner Offer Teaser Label */}
        <VVDealsTopTeaser className="mb-10 sm:mb-14" />

        {/* Pricing Cards Grid */}
        {loading ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400 font-medium">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            Loading pricing plans...
          </div>
        ) : (
          <div className="mb-16 grid grid-cols-1 gap-6 sm:mb-24 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 items-stretch">
            {plans.map((plan) => {
              const allFeatures = plan.feature_items
                ? plan.feature_items.map((item) => ({ key: item.key || item.label, label: item.label || item.key, enabled: Boolean(item.enabled) }))
                : (Array.isArray(plan.features) ? plan.features : []).map((f) => ({ key: String(f), label: String(f), enabled: true }));
              const visibleFeatures = allExpanded ? allFeatures : allFeatures.slice(0, 7);
              const hasMoreFeatures = allFeatures.length > 7;
              const isPopular = plan.is_popular;
              const isUltra = plan.plan_code === 'ultra' || plan.name.toLowerCase().includes('ultra');
              const unitMonthly = plan.price_monthly_inr;
              const unitYearly = plan.price_yearly_inr;
              const unitYearlyMonthly = plan.price_yearly_monthly_inr;
              const effectiveDisplayPrice = isYearly && unitYearlyMonthly > 0 ? unitYearlyMonthly : unitMonthly;
              const planLimits = buildPlanLimitItems(plan);

              return (
                <div
                  key={plan.id || plan.plan_code}
                  className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition-all duration-300 hover:translate-y-[-2px] ${
                    isPopular
                      ? 'z-10 bg-gray-900 text-white shadow-2xl ring-2 ring-purple-500/50 dark:bg-gradient-to-b dark:from-purple-950/40 dark:via-neutral-900 dark:to-neutral-950'
                      : isUltra
                      ? 'border-2 border-purple-500/40 bg-gradient-to-b from-purple-50/50 via-white to-white text-gray-900 shadow-xl hover:border-purple-500/60 dark:border-purple-500/40 dark:from-purple-950/25 dark:via-neutral-900/60 dark:to-neutral-950 dark:text-gray-100'
                      : 'border border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-xl dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 dark:hover:border-white/[0.14]'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-4 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-purple-500/25">
                      Most Popular
                    </div>
                  )}
                  {isUltra && !isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-purple-500/20">
                      🎁 Get Bonus
                    </div>
                  )}

                  <div>
                    {/* Plan Header */}
                    <div className="mb-6 pt-2">
                      <h3 className="text-xl font-black">{plan.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-3xl font-black sm:text-4xl">
                          {plan.plan_code === 'free' ? 'Free' : formatMoney(effectiveDisplayPrice, currency)}
                        </span>
                        <span className={`text-xs font-semibold ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                          /month per account
                        </span>
                      </div>

                      {plan.plan_code !== 'free' ? (
                        <p className={`mt-2 text-xs font-medium ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isYearly && plan.price_yearly_inr > 0
                            ? `Billed annually at ${formatMoney(unitYearly, currency)}/year`
                            : 'Billed monthly, cancel anytime'}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Free forever for testing and basic automations
                        </p>
                      )}

                      {isYearly && plan.price_yearly_monthly_inr > 0 && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Zap size={13} className="fill-current" />
                          <span>Save with yearly billing</span>
                        </div>
                      )}

                      {/* Ultra Plan VVDeals Bonus Highlight Box */}
                      {isUltra && (
                        <div className="mt-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs dark:bg-purple-950/40">
                          <div className="flex items-center gap-1.5 font-black text-purple-700 dark:text-purple-300">
                            <Gift size={14} className="text-pink-500" />
                            <span>Included Partner Perks (VV Deals):</span>
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 leading-snug">
                            {isYearly
                              ? 'Google AI Pro (18M), Amazon Prime (6M), Spotify (3M), CapCut Pro (1M) & Netflix (1M)'
                              : 'Amazon Prime (1M), CapCut Pro (7 Days) & Netflix (5 Days)'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Plan Limits Box */}
                    <div
                      className={`mb-6 rounded-2xl border p-4 ${
                        isPopular
                          ? 'border-white/10 bg-white/5'
                          : 'border-gray-200 bg-gray-50/80 dark:border-white/[0.08] dark:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                          Account Limits
                        </p>
                        <InfoPopover
                          title="Account Usage Limits"
                          description="Every connected Instagram account gets its own independent action budget and limits."
                          formula="Limits reset every hourly, daily, and monthly rolling window."
                          className="shrink-0"
                        />
                      </div>
                      <div className="space-y-2.5">
                        {planLimits.map((item) => (
                          <div key={`${plan.id}-${item.label}`} className="flex items-center justify-between gap-4 text-xs">
                            <span className={isPopular ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}>{item.label}</span>
                            <span className="font-bold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-3">
                      <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isPopular ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        Included Features
                      </p>
                      {visibleFeatures.map((feature) => (
                        <div key={`${plan.id || plan.plan_code}-${feature.key}`} className={`flex items-start gap-2.5 text-xs sm:text-sm ${!feature.enabled ? 'opacity-40' : ''}`}>
                          <div className={`mt-0.5 shrink-0 ${feature.enabled ? (isPopular ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-gray-400 dark:text-gray-500'}`}>
                            {feature.enabled ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={2.5} />}
                          </div>
                          <span className={feature.enabled ? 'font-medium leading-snug' : 'line-through text-muted-foreground'}>{feature.label}</span>
                        </div>
                      ))}
                    </div>

                    {hasMoreFeatures && (
                      <button
                        type="button"
                        onClick={toggleAllCards}
                        className={`mt-4 flex items-center gap-1.5 text-xs font-bold hover:underline ${
                          isPopular ? 'text-purple-300' : 'text-primary'
                        }`}
                      >
                        {allExpanded ? (
                          <>
                            <span>Show fewer features</span>
                            <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            <span>View all features</span>
                            <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* CTA Button */}
                  <div className={`mt-8 border-t pt-5 ${isPopular ? 'border-white/10' : 'border-gray-100 dark:border-white/[0.06]'}`}>
                    <AuthRedirectButton
                      className={`flex h-12 w-full items-center justify-center rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all duration-200 active:scale-98 ${
                        isPopular
                          ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 text-white shadow-purple-500/20 hover:opacity-95'
                          : 'bg-gray-900 text-white shadow-black/5 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                      }`}
                    >
                      {plan.button_text || (plan.plan_code === 'free' ? 'Get Started Free' : 'Get Started')}
                    </AuthRedirectButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VVDeals Comprehensive Offer Details, FAQs & Terms Section */}
        <VVDealsOfferSection className="mb-16 sm:mb-24" />

        {/* Comparison Table Section */}
        {comparisonRows.length > 0 && (
          <div className="mt-16 sm:mt-24">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">
                Compare All Features Side by Side
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 sm:text-base">
                Explore full capability breakdown across every subscription tier.
              </p>
            </div>
            
            <div className="overflow-x-auto rounded-3xl border border-gray-200 shadow-xl dark:border-white/[0.08] bg-white dark:bg-neutral-900/60 backdrop-blur-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <th className="sticky left-0 bg-gray-50 p-4 sm:p-5 text-sm font-black text-gray-900 dark:bg-neutral-900 dark:text-white">
                      Feature Comparison
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="p-4 sm:p-5 text-center text-sm font-black text-gray-900 dark:text-white">
                        {plan.name.replace(' Plan', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {comparisonRows.map((row) => (
                    <tr key={`comp-row-${row.key}`} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                      <td className="sticky left-0 bg-white p-4 sm:p-5 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-white/[0.02]">
                        {row.label}
                      </td>
                      {plans.map((plan, planIdx) => {
                        const value = row.values[plan.plan_code || plan.id];
                        return (
                          <td key={`comp-cell-${row.key}-${planIdx}`} className="p-4 sm:p-5 text-center text-sm text-gray-600 dark:text-gray-400">
                            {typeof value === 'boolean'
                              ? (value ? <Check className="mx-auto text-emerald-500" size={18} strokeWidth={2.5} /> : <X className="mx-auto text-gray-300 dark:text-gray-600" size={18} strokeWidth={2} />)
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

