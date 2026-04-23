export type PricingComparisonItem = {
  key?: string;
  label?: string;
  value?: unknown;
};

export type PricingPlan = {
  id: string;
  plan_code: string;
  name: string;
  price_monthly_inr: number;
  price_monthly_usd: number;
  price_yearly_inr: number;
  price_yearly_usd: number;
  price_yearly_monthly_inr: number;
  price_yearly_monthly_usd: number;
  is_custom: boolean;
  is_popular: boolean;
  display_order: number;
  button_text: string;
  yearly_bonus: string;
  features: string[];
  comparison: PricingComparisonItem[];
  instagram_connections_limit: number | null;
  actions_per_hour_limit: number | null;
  actions_per_day_limit: number | null;
  actions_per_month_limit: number | null;
};

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const parseObjectArray = (value: unknown): PricingComparisonItem[] => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizePlan = (raw: any): PricingPlan => ({
  id: String(raw?.id ?? raw?.$id ?? ''),
  plan_code: String(raw?.plan_code ?? '').trim().toLowerCase(),
  name: String(raw?.name ?? 'Plan'),
  price_monthly_inr: Number(raw?.price_monthly_inr ?? 0),
  price_monthly_usd: Number(raw?.price_monthly_usd ?? 0),
  price_yearly_inr: Number(raw?.price_yearly_inr ?? 0),
  price_yearly_usd: Number(raw?.price_yearly_usd ?? 0),
  price_yearly_monthly_inr: Number(raw?.price_yearly_monthly_inr ?? 0),
  price_yearly_monthly_usd: Number(raw?.price_yearly_monthly_usd ?? 0),
  is_custom: Boolean(raw?.is_custom),
  is_popular: Boolean(raw?.is_popular),
  display_order: Number(raw?.display_order ?? 0),
  button_text: String(raw?.button_text ?? 'Choose Plan'),
  yearly_bonus: String(raw?.yearly_bonus ?? ''),
  features: parseStringArray(raw?.features),
  comparison: parseObjectArray(raw?.comparison ?? raw?.comparison_json),
  instagram_connections_limit: raw?.instagram_connections_limit == null ? null : Number(raw.instagram_connections_limit),
  actions_per_hour_limit: raw?.actions_per_hour_limit == null ? null : Number(raw.actions_per_hour_limit),
  actions_per_day_limit: raw?.actions_per_day_limit == null ? null : Number(raw.actions_per_day_limit),
  actions_per_month_limit: raw?.actions_per_month_limit == null ? null : Number(raw.actions_per_month_limit)
});

export const normalizePricingPayload = (payload: any): PricingPlan[] => {
  const rawPlans = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.plans)
      ? payload.plans
      : Array.isArray(payload?.documents)
        ? payload.documents
        : [];
  return rawPlans
    .map((plan: any) => normalizePlan(plan))
    .sort((a: PricingPlan, b: PricingPlan) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });
};

const normalizeIdentifier = (value: unknown) => String(value || '').trim().toLowerCase();

export const getPlanSortValue = (plan: PricingPlan) => {
  if (Number.isFinite(plan.display_order)) {
    return Number(plan.display_order);
  }
  return Number.MAX_SAFE_INTEGER;
};

export const findPricingPlan = (plans: PricingPlan[], identifier?: string | null) => {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  return plans.find((plan) => {
    return normalizeIdentifier(plan.id) === normalized
      || normalizeIdentifier(plan.plan_code) === normalized
      || normalizeIdentifier(plan.name) === normalized;
  }) || null;
};

export const getUpgradePlans = (
  plans: PricingPlan[],
  currentPlanIdentifier?: string | null,
  currentPlanName?: string | null
) => {
  const currentPlan = findPricingPlan(plans, currentPlanIdentifier) || findPricingPlan(plans, currentPlanName);
  const currentSortValue = currentPlan ? getPlanSortValue(currentPlan) : Number.NEGATIVE_INFINITY;

  return plans.filter((plan) => {
    if (plan.plan_code === 'free') return false;
    if (currentPlan && normalizeIdentifier(plan.id) === normalizeIdentifier(currentPlan.id)) return false;
    return getPlanSortValue(plan) > currentSortValue;
  });
};

export const getPaidCheckoutPlans = (
  plans: PricingPlan[],
  currentPlanIdentifier?: string | null,
  currentPlanName?: string | null
) => {
  const currentPlan = findPricingPlan(plans, currentPlanIdentifier) || findPricingPlan(plans, currentPlanName);

  return plans.filter((plan) => {
    if (plan.plan_code === 'free') return false;
    if (currentPlan && normalizeIdentifier(plan.id) === normalizeIdentifier(currentPlan.id)) return false;
    return true;
  });
};

export const getPlanBigPrice = (plan: PricingPlan, currency: 'INR' | 'USD', isYearly: boolean): number => {
  if (currency === 'INR') {
    return isYearly ? plan.price_yearly_monthly_inr : plan.price_monthly_inr;
  }
  return isYearly ? plan.price_yearly_monthly_usd : plan.price_monthly_usd;
};

export const getPlanBilledTotal = (plan: PricingPlan, currency: 'INR' | 'USD', isYearly: boolean): number => {
  if (currency === 'INR') {
    return isYearly ? plan.price_yearly_inr : plan.price_monthly_inr;
  }
  return isYearly ? plan.price_yearly_usd : plan.price_monthly_usd;
};

export const formatMoney = (value: number, currency: 'INR' | 'USD') => {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
};

export const formatPlanLimit = (value: number | null, suffix?: string) => {
  if (value == null) return 'Unlimited';
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
  return suffix ? `${formatted} ${suffix}` : formatted;
};
