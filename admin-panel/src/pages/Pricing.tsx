import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Loader2,
  Save,
  Sparkles,
  Layers3,
  ArrowUpDown,
  BadgeIndianRupee,
  DollarSign,
  Plus,
  Trash2
} from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { clearCachedResource, loadCachedResource } from '../lib/resourceCache';

type PricingPlan = {
  id: string;
  name: string;
  plan_code: string;
  price_monthly_inr: number;
  price_monthly_usd: number;
  price_yearly_inr: number;
  price_yearly_usd: number;
  price_yearly_monthly_inr: number;
  price_yearly_monthly_usd: number;
  yearly_bonus: string;
  button_text: string;
  is_popular: boolean;
  is_custom?: boolean;
  display_order?: number;
  instagram_connections_limit?: number;
  actions_per_hour_limit?: number;
  actions_per_day_limit?: number;
  actions_per_month_limit?: number;
  instagram_link_limit?: number;
  features: string[];
  comparison?: Array<{ key?: string; label?: string; value?: boolean | string | number }>;
  entitlements?: Record<string, boolean>;
  benefits?: Array<{ key: string; label: string; enabled: boolean }>;
};

const surfaceClass = 'glass-card rounded-[32px] border border-border/70 bg-card/95 shadow-[0_22px_65px_rgba(15,23,42,0.07)]';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const numericFields: Array<{ key: keyof PricingPlan; label: string }> = [
  { key: 'price_monthly_inr', label: 'Monthly INR' },
  { key: 'price_monthly_usd', label: 'Monthly USD' },
  { key: 'price_yearly_inr', label: 'Yearly INR' },
  { key: 'price_yearly_usd', label: 'Yearly USD' },
  { key: 'price_yearly_monthly_inr', label: 'Yearly monthly INR' },
  { key: 'price_yearly_monthly_usd', label: 'Yearly monthly USD' },
  { key: 'instagram_connections_limit', label: 'Instagram accounts' },
  { key: 'instagram_link_limit', label: 'Linked account slots' },
  { key: 'actions_per_hour_limit', label: 'Actions per hour' },
  { key: 'actions_per_day_limit', label: 'Actions per day' },
  { key: 'actions_per_month_limit', label: 'Actions per month' },
  { key: 'display_order', label: 'Display order' }
];

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[24px] border border-border/70 bg-background/60 px-5 py-4">
    <p className="text-[10px] font-black text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-extrabold text-foreground">{value}</p>
  </div>
);

const TogglePill = ({
  checked,
  onChange,
  label,
  activeLabel
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  activeLabel: string;
}) => (
  <button
    type="button"
    onClick={onChange}
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
      checked
        ? 'border-primary/40 bg-primary/10 text-primary'
        : 'border-border bg-background/70 text-muted-foreground hover:border-primary/20 hover:text-foreground'
    }`}
  >
    <span className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
    {checked ? activeLabel : label}
  </button>
);

const SummaryMetric = ({
  icon: Icon,
  label,
  value,
  accent
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) => (
  <div className="rounded-[24px] border border-border/70 bg-background/60 px-4 py-4">
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-black text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-extrabold text-foreground">{value}</p>
      </div>
    </div>
  </div>
);

const FeatureRow = ({
  value,
  index,
  onChange,
  onRemove
}: {
  value: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) => (
  <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-card/80 px-4 py-3">
    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
      {String(index + 1).padStart(2, '0')}
    </span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Feature label"
      className="input-base border-none bg-transparent p-0 shadow-none focus:border-none focus:shadow-none"
    />
    <button
      type="button"
      onClick={onRemove}
      className="shrink-0 rounded-xl border border-destructive/20 bg-destructive/5 p-2 text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
      title="Remove feature"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
);

export const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([]);
  const [featureEditorMode, setFeatureEditorMode] = useState<Record<string, 'list' | 'text'>>({});

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await loadCachedResource('admin:pricing:plans', () => httpClient.get('/api/admin/pricing'), 30000);
      const nextPlans = (response.data?.plans || []).map((plan: PricingPlan) => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      }));
      setPlans(nextPlans);
      setExpandedPlanIds((current) => current.filter((id) => nextPlans.some((plan: PricingPlan) => plan.id === id)));
    } catch (error) {
      console.error('Failed to load pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const updatePlan = (planId: string, key: keyof PricingPlan, value: string | number | boolean | string[]) => {
    setPlans((current) => current.map((plan) => (plan.id === planId ? { ...plan, [key]: value } : plan)));
  };

  const updateFeature = (planId: string, index: number, value: string) => {
    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const nextFeatures = [...(plan.features || [])];
        nextFeatures[index] = value;
        return { ...plan, features: nextFeatures };
      })
    );
  };

  const toggleBenefit = (planId: string, benefitKey: string) => {
    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const currentEnabled = plan.entitlements?.[benefitKey] === true;
        const nextEntitlements = {
          ...(plan.entitlements || {}),
          [benefitKey]: !currentEnabled
        };
        const nextBenefits = (plan.benefits || []).map((benefit) =>
          benefit.key === benefitKey ? { ...benefit, enabled: !currentEnabled } : benefit
        );
        return {
          ...plan,
          entitlements: nextEntitlements,
          benefits: nextBenefits
        };
      })
    );
  };

  const addFeature = (planId: string) => {
    setPlans((current) =>
      current.map((plan) => (plan.id === planId ? { ...plan, features: [...(plan.features || []), ''] } : plan))
    );
  };

  const removeFeature = (planId: string, index: number) => {
    setPlans((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        return {
          ...plan,
          features: (plan.features || []).filter((_, featureIndex) => featureIndex !== index)
        };
      })
    );
  };

  const updateFeaturesFromText = (planId: string, value: string) => {
    const nextFeatures = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    updatePlan(planId, 'features', nextFeatures);
  };

  const savePlan = async (plan: PricingPlan) => {
    setSavingId(plan.id);
    try {
      await httpClient.patch(`/api/admin/pricing/${plan.id}`, {
        ...plan,
        features: (plan.features || []).map((item) => item.trim()).filter(Boolean),
        benefits: (plan.benefits || []).reduce<Record<string, boolean>>((acc, benefit) => {
          acc[benefit.key] = benefit.enabled === true;
          return acc;
        }, {}),
        entitlements: plan.entitlements || {},
        comparison: plan.comparison || []
      });
      clearCachedResource('admin:pricing:plans');
      await loadPlans();
    } catch (error) {
      console.error('Failed to save pricing:', error);
    } finally {
      setSavingId(null);
    }
  };

  const togglePlan = (planId: string) => {
    setExpandedPlanIds((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId]
    );
  };

  const stats = useMemo(() => {
    const popularPlans = plans.filter((plan) => plan.is_popular).length;
    const customPlans = plans.filter((plan) => plan.is_custom).length;
    const topMonthlyInr = plans.reduce((highest, plan) => Math.max(highest, Number(plan.price_monthly_inr || 0)), 0);

    return {
      totalPlans: plans.length,
      popularPlans,
      customPlans,
      topMonthlyInr
    };
  }, [plans]);

  if (loading) {
    return <AdminLoadingState title="Loading pricing" description="Fetching live plans, billing amounts, and editable pricing fields." />;
  }

  return (
    <div className="space-y-9 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className={`${surfaceClass} overflow-hidden p-7 sm:p-9`}>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_420px] xl:items-start">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-primary/20 bg-gradient-to-r from-primary/12 to-transparent px-3 py-1 text-[10px] font-black text-primary">
              Pricing Control
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Plan management</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                Keep summaries visible. Open a plan only when you need to tune billing, limits, or feature copy.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Plans" value={String(stats.totalPlans)} />
            <StatTile label="Popular" value={String(stats.popularPlans)} />
            <StatTile label="Custom" value={String(stats.customPlans)} />
            <StatTile label="Top monthly INR" value={inrFormatter.format(stats.topMonthlyInr)} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {plans.map((plan) => {
          const isExpanded = expandedPlanIds.includes(plan.id);
          const cleanFeatures = (plan.features || []).filter((item) => item.trim());

          return (
            <article key={plan.id} className={`${surfaceClass} overflow-hidden`}>
              <div className="border-b border-border/60 px-6 py-6 sm:px-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[1.7rem] font-extrabold tracking-tight text-foreground">{plan.name}</h2>
                      <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[10px] font-black text-muted-foreground">
                        {plan.plan_code || 'no code'}
                      </span>
                      {plan.is_popular && (
                        <span className="rounded-full border border-primary/20 bg-gradient-to-r from-primary/15 to-primary/5 px-3 py-1 text-[10px] font-black text-primary">
                          Popular
                        </span>
                      )}
                      {plan.is_custom && (
                        <span className="rounded-full border border-warning/30 bg-warning-muted/70 px-3 py-1 text-[10px] font-black text-warning-foreground">
                          Custom
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryMetric
                        icon={BadgeIndianRupee}
                        label="Monthly"
                        value={`${inrFormatter.format(Number(plan.price_monthly_inr || 0))} / ${usdFormatter.format(Number(plan.price_monthly_usd || 0))}`}
                        accent="bg-primary/12 text-primary"
                      />
                      <SummaryMetric
                        icon={DollarSign}
                        label="Yearly"
                        value={`${inrFormatter.format(Number(plan.price_yearly_inr || 0))} / ${usdFormatter.format(Number(plan.price_yearly_usd || 0))}`}
                        accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      />
                      <SummaryMetric
                        icon={Layers3}
                        label="Features"
                        value={`${cleanFeatures.length} active`}
                        accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      />
                      <SummaryMetric
                        icon={ArrowUpDown}
                        label="Order"
                        value={String(plan.display_order || 0)}
                        accent="bg-foreground/5 text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    <TogglePill
                      checked={plan.is_popular}
                      onChange={() => updatePlan(plan.id, 'is_popular', !plan.is_popular)}
                      label="Mark popular"
                      activeLabel="Popular plan"
                    />
                    <TogglePill
                      checked={Boolean(plan.is_custom)}
                      onChange={() => updatePlan(plan.id, 'is_custom', !plan.is_custom)}
                      label="Standard plan"
                      activeLabel="Custom plan"
                    />
                    <button
                      type="button"
                      onClick={() => togglePlan(plan.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-4 py-3 text-xs font-black text-foreground transition hover:border-primary/30 hover:text-primary"
                    >
                      {isExpanded ? 'Collapse' : 'Advanced'}
                      <ChevronDown className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => savePlan(plan)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[rgb(64,93,230)] px-4 py-3 text-xs font-black text-white shadow-lg shadow-primary/20 transition hover:opacity-95"
                    >
                      {savingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save plan
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-7 px-6 py-7 sm:px-8">
                  <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
                        <label className="text-[10px] font-black text-muted-foreground">Plan name</label>
                        <input
                          value={plan.name || ''}
                          onChange={(event) => updatePlan(plan.id, 'name', event.target.value)}
                          className="input-base mt-3"
                        />
                      </div>
                      <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
                        <label className="text-[10px] font-black text-muted-foreground">Plan code</label>
                        <input
                          value={plan.plan_code || ''}
                          onChange={(event) => updatePlan(plan.id, 'plan_code', event.target.value)}
                          className="input-base mt-3"
                        />
                      </div>
                      <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
                        <label className="text-[10px] font-black text-muted-foreground">CTA text</label>
                        <input
                          value={plan.button_text || ''}
                          onChange={(event) => updatePlan(plan.id, 'button_text', event.target.value)}
                          className="input-base mt-3"
                        />
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-border/70 bg-background/60 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground">Plan snapshot</p>
                          <p className="mt-1 text-sm font-extrabold text-foreground">{plan.button_text || 'Choose Plan'}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-border/60 bg-card/80 px-4 py-4">
                          <p className="text-[10px] font-black text-muted-foreground">Annual monthly</p>
                          <p className="mt-2 text-sm font-extrabold text-foreground">
                            {inrFormatter.format(Number(plan.price_yearly_monthly_inr || 0))} / {usdFormatter.format(Number(plan.price_yearly_monthly_usd || 0))}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-border/60 bg-card/80 px-4 py-4">
                          <p className="text-[10px] font-black text-muted-foreground">Monthly actions</p>
                          <p className="mt-2 text-sm font-extrabold text-foreground">{plan.actions_per_month_limit || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {numericFields.map((field) => (
                      <div key={String(field.key)} className="rounded-[24px] border border-border/70 bg-background/60 p-4">
                        <label className="text-[10px] font-black text-muted-foreground">{field.label}</label>
                        <input
                          type="number"
                          value={Number(plan[field.key] || 0)}
                          onChange={(event) => updatePlan(plan.id, field.key, Number(event.target.value || 0))}
                          className="input-base mt-3"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[30px] border border-border/70 bg-background/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground">Plan features</p>
                        <p className="mt-1 text-sm text-muted-foreground">Edit each feature separately or switch to bulk text mode.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[10px] font-black text-muted-foreground">
                          {cleanFeatures.length} saved
                        </span>
                        <div className="inline-flex rounded-2xl border border-border/70 bg-card/80 p-1">
                          <button
                            type="button"
                            onClick={() => setFeatureEditorMode((current) => ({ ...current, [plan.id]: 'list' }))}
                            className={`rounded-xl px-3 py-2 text-[10px] font-black transition ${
                              (featureEditorMode[plan.id] || 'list') === 'list'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            List
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeatureEditorMode((current) => ({ ...current, [plan.id]: 'text' }))}
                            className={`rounded-xl px-3 py-2 text-[10px] font-black transition ${
                              (featureEditorMode[plan.id] || 'list') === 'text'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Text
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => addFeature(plan.id)}
                          disabled={(featureEditorMode[plan.id] || 'list') === 'text'}
                          className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-black text-primary transition hover:bg-primary hover:text-primary-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          Add feature
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {(featureEditorMode[plan.id] || 'list') === 'text' ? (
                        <textarea
                          value={(plan.features || []).join('\n')}
                          onChange={(event) => updateFeaturesFromText(plan.id, event.target.value)}
                          placeholder={'One feature per line\nInstagram account limits\nAction limits\nAdvanced automation settings'}
                          rows={Math.max(6, (plan.features || []).length + 2)}
                          className="input-base min-h-[220px] resize-y py-4"
                        />
                      ) : (plan.features || []).length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm font-medium text-muted-foreground">
                          No features yet.
                        </div>
                      ) : (
                        (plan.features || []).map((feature, index) => (
                          <FeatureRow
                            key={`${plan.id}-feature-${index}`}
                            value={feature}
                            index={index}
                            onChange={(value) => updateFeature(plan.id, index, value)}
                            onRemove={() => removeFeature(plan.id, index)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-border/70 bg-background/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground">Plan benefits</p>
                        <p className="mt-1 text-sm text-muted-foreground">Turn each runtime entitlement on or off for this plan.</p>
                      </div>
                      <span className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[10px] font-black text-muted-foreground">
                        {(plan.benefits || []).filter((benefit) => benefit.enabled).length} enabled
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {(plan.benefits || []).map((benefit) => (
                        <button
                          key={`${plan.id}-${benefit.key}`}
                          type="button"
                          onClick={() => toggleBenefit(plan.id, benefit.key)}
                          className={`rounded-[22px] border px-4 py-4 text-left transition ${
                            benefit.enabled
                              ? 'border-primary/30 bg-primary/10 text-foreground shadow-sm'
                              : 'border-border/70 bg-card/80 text-muted-foreground hover:border-primary/20 hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-extrabold">{benefit.label}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${benefit.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {benefit.enabled ? 'On' : 'Off'}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px]">{benefit.key}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default PricingPage;
