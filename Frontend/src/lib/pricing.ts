export type PricingComparisonItem = {
  key?: string;
  label?: string;
  value?: unknown;
};

export type PricingComparisonRow = {
  key: string;
  label: string;
  values: Record<string, unknown>;
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
  feature_items?: Array<{ key: string; label: string; enabled: boolean }>;
  feature_flags?: Record<string, boolean>;
  comparison: PricingComparisonItem[];
  limits?: Record<string, number | null>;
  instagram_connections_limit: number | null;
  instagram_link_limit?: number | null;
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

const toNullableNumber = (...values: unknown[]): number | null => {
  const found = values.find((value) => value !== null && value !== undefined && value !== '');
  if (found === undefined) return null;
  const numeric = Number(found);
  return Number.isFinite(numeric) ? numeric : null;
};

export const normalizePlan = (raw: any): PricingPlan => ({
  id: String(raw?.id ?? raw?.$id ?? ''),
  plan_code: String(raw?.plan_code ?? '').trim().toLowerCase(),
  name: String(raw?.name ?? 'Plan'),
  price_monthly_inr: Number(raw?.pricing?.monthly?.inr ?? raw?.price_monthly_inr ?? 0),
  price_monthly_usd: Number(raw?.pricing?.monthly?.usd ?? raw?.price_monthly_usd ?? 0),
  price_yearly_inr: Number(raw?.pricing?.yearly?.inr ?? raw?.price_yearly_inr ?? 0),
  price_yearly_usd: Number(raw?.pricing?.yearly?.usd ?? raw?.price_yearly_usd ?? 0),
  price_yearly_monthly_inr: Number(raw?.pricing?.yearly_monthly_display?.inr ?? raw?.price_yearly_monthly_inr ?? 0),
  price_yearly_monthly_usd: Number(raw?.pricing?.yearly_monthly_display?.usd ?? raw?.price_yearly_monthly_usd ?? 0),
  is_custom: Boolean(raw?.is_custom),
  is_popular: Boolean(raw?.is_popular),
  display_order: Number(raw?.display_order ?? 0),
  button_text: String(raw?.button_text ?? 'Choose Plan'),
  yearly_bonus: String(raw?.yearly_bonus ?? ''),
  features: Array.isArray(raw?.feature_items)
    ? raw.feature_items.filter((item: any) => item?.enabled === true).map((item: any) => String(item.label || item.key || '').trim()).filter(Boolean)
    : parseStringArray(raw?.features),
  feature_items: Array.isArray(raw?.feature_items) ? raw.feature_items : undefined,
  feature_flags: raw?.features && typeof raw.features === 'object' && !Array.isArray(raw.features) ? raw.features : undefined,
  comparison: parseObjectArray(raw?.comparison ?? raw?.comparison_json),
  limits: raw?.limits,
  instagram_connections_limit: toNullableNumber(raw?.limits?.instagram_connections_limit, raw?.limits?.connections, raw?.instagram_connections_limit),
  instagram_link_limit: toNullableNumber(raw?.limits?.instagram_link_limit, raw?.instagram_link_limit),
  actions_per_hour_limit: toNullableNumber(raw?.limits?.actions_per_hour_limit, raw?.limits?.per_hour, raw?.actions_per_hour_limit),
  actions_per_day_limit: toNullableNumber(raw?.limits?.actions_per_day_limit, raw?.limits?.per_day, raw?.actions_per_day_limit),
  actions_per_month_limit: toNullableNumber(raw?.limits?.actions_per_month_limit, raw?.limits?.per_month, raw?.actions_per_month_limit)
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

const DEFAULT_LIMIT_COMPARISON_ROWS: Array<{
  key: string;
  label: string;
  value: (plan: PricingPlan) => unknown;
}> = [
  {
    key: 'instagram_connections_limit',
    label: 'Instagram connections',
    value: (plan) => formatPlanLimit(plan.instagram_connections_limit)
  },
  {
    key: 'actions_per_hour_limit',
    label: 'Actions per hour',
    value: (plan) => formatPlanLimit(plan.actions_per_hour_limit)
  },
  {
    key: 'actions_per_day_limit',
    label: 'Actions per day',
    value: (plan) => formatPlanLimit(plan.actions_per_day_limit)
  },
  {
    key: 'actions_per_month_limit',
    label: 'Actions per month',
    value: (plan) => formatPlanLimit(plan.actions_per_month_limit)
  }
];

export const buildPlanLimitItems = (plan: PricingPlan): Array<{ label: string; value: string }> => ([
  { label: 'Instagram connections', value: formatPlanLimit(plan.instagram_connections_limit) },
  { label: 'Actions / hour', value: formatPlanLimit(plan.actions_per_hour_limit) },
  { label: 'Actions / day', value: formatPlanLimit(plan.actions_per_day_limit) },
  { label: 'Actions / month', value: formatPlanLimit(plan.actions_per_month_limit) }
]);

export const buildPricingComparisonRows = (plans: PricingPlan[]): PricingComparisonRow[] => {
  const rows = new Map<string, PricingComparisonRow>();

  DEFAULT_LIMIT_COMPARISON_ROWS.forEach((row) => {
    rows.set(row.key, {
      key: row.key,
      label: row.label,
      values: {}
    });
  });

  plans.forEach((plan) => {
    const planKey = plan.plan_code || plan.id;

    DEFAULT_LIMIT_COMPARISON_ROWS.forEach((row) => {
      const existing = rows.get(row.key);
      if (!existing) return;
      existing.values[planKey] = row.value(plan);
    });

    if (Array.isArray(plan.feature_items) && plan.feature_items.length > 0) {
      plan.feature_items.forEach((item) => {
        const key = String(item.key || item.label || '').trim();
        const label = String(item.label || item.key || '').trim();
        if (!key || !label) return;
        const existing = rows.get(key) || { key, label, values: {} };
        existing.values[planKey] = Boolean(item.enabled);
        rows.set(key, existing);
      });
    } else if (Array.isArray(plan.comparison) && plan.comparison.length > 0) {
      plan.comparison.forEach((item) => {
        const key = String(item.key || item.label || '').trim();
        const label = String(item.label || item.key || '').trim();
        if (!key || !label) return;
        const existing = rows.get(key) || { key, label, values: {} };
        existing.values[planKey] = item.value;
        rows.set(key, existing);
      });
    }
  });

  return Array.from(rows.values());
};
