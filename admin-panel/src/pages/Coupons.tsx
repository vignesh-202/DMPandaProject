import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, CheckCircle2, Copy, CreditCard, Layers, Loader2, PencilLine, Plus, Receipt, RefreshCcw, Search, SlidersHorizontal, Sparkles, Tag, TicketPercent, TrendingUp, XCircle } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';
import SelectField from '../components/ui/SelectField';

type CouponRecord = {
    id: string;
    code: string;
    type: 'fixed' | 'percent';
    value: number;
    active: boolean;
    expires_at: string | null;
    timing_status?: 'expired' | 'scheduled' | 'no_expiry';
    billing_cycle_targets?: string[];
    plan_ids: string[];
    user_ids: string[];
    usage_limit: number;
    usage_per_user: number;
    one_time_use: boolean;
    redemption_count: number;
    created_at?: string | null;
    updated_at?: string | null;
};

type RedemptionRecord = {
    id: string;
    coupon_code: string;
    plan_id: string | null;
    final_amount: number;
    currency: string;
    status: string;
    created_at: string | null;
};

type AvailablePlan = {
    id: string;
    name: string;
    plan_code: string;
};

type CouponsResponse = {
    stats?: {
        coupons_total?: number;
        active_coupons?: number;
        redemptions_total?: number;
        revenue_total?: number;
    };
    coupons?: CouponRecord[];
    redemptions?: RedemptionRecord[];
    available_plans?: AvailablePlan[];
};

type CouponForm = {
    code: string;
    type: 'fixed' | 'percent';
    value: string;
    active: boolean;
    expires_at: string;
    billing_cycle_targets: string[];
    plan_ids: string[];
    user_ids: string;
    usage_limit: string;
    one_time_use: boolean;
    bulk_count: string;
};

const EMPTY_FORM: CouponForm = {
    code: '',
    type: 'percent',
    value: '',
    active: true,
    expires_at: '',
    billing_cycle_targets: ['monthly', 'yearly'],
    plan_ids: [],
    user_ids: '',
    usage_limit: '',
    one_time_use: true,
    bulk_count: '1'
};

const formatDateTimeInput = (value: string | null | undefined) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildPayload = (form: CouponForm) => ({
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: Number(form.value || 0),
    active: form.active,
    expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    billing_cycle_targets: form.billing_cycle_targets,
    plan_ids: form.plan_ids,
    usage_limit: Number(form.usage_limit || 0),
    one_time_use: form.one_time_use,
    bulk_count: Number(form.bulk_count || 1),
    user_ids: form.user_ids
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
});

const mapCouponToForm = (coupon: CouponRecord): CouponForm => ({
    code: coupon.code || '',
    type: coupon.type || 'percent',
    value: String(coupon.value ?? ''),
    active: coupon.active !== false,
    expires_at: formatDateTimeInput(coupon.expires_at),
    billing_cycle_targets: Array.isArray(coupon.billing_cycle_targets) && coupon.billing_cycle_targets.length > 0
        ? coupon.billing_cycle_targets
        : ['monthly', 'yearly'],
    plan_ids: Array.isArray(coupon.plan_ids) ? coupon.plan_ids : [],
    user_ids: Array.isArray(coupon.user_ids) ? coupon.user_ids.join(', ') : '',
    usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : '',
    one_time_use: coupon.one_time_use === true || Number(coupon.usage_per_user || 0) === 1,
    bulk_count: '1'
});

type CouponFilterStatus = 'all' | 'active' | 'inactive' | 'unused';
type CouponFilterType = 'all' | 'percent' | 'fixed';
type CouponFilterExpiry = 'all' | 'expired' | 'expiring' | 'scheduled' | 'no_expiry';
type CouponSort = 'recent' | 'expiry' | 'value' | 'usage' | 'code';

const isFutureDate = (value: string | null | undefined) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
};

const isExpiringSoon = (value: string | null | undefined, days = 14) => {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const remaining = parsed.getTime() - Date.now();
    return remaining >= 0 && remaining <= days * 24 * 60 * 60 * 1000;
};

const isExpiredDate = (value: string | null | undefined) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
};

const formatCouponValue = (coupon: CouponRecord) =>
    coupon.type === 'percent'
        ? `${coupon.value}% off`
        : `Rs ${Number(coupon.value || 0).toLocaleString('en-IN')} off`;

const normalizeSearchToken = (value: string) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const isSequentialMatch = (needle: string, haystack: string) => {
    if (!needle || !haystack) return false;
    let cursor = 0;
    for (const character of haystack) {
        if (character === needle[cursor]) {
            cursor += 1;
            if (cursor >= needle.length) return true;
        }
    }
    return false;
};

const scoreCouponSearch = (query: string, coupon: CouponRecord) => {
    const normalizedQuery = normalizeSearchToken(query);
    if (!normalizedQuery) return 1;

    const searchableValues = [
        coupon.code,
        coupon.type,
        String(coupon.value || ''),
        ...(coupon.billing_cycle_targets || []),
        ...(coupon.plan_ids || [])
    ]
        .map(normalizeSearchToken)
        .filter(Boolean);

    let bestScore = 0;
    searchableValues.forEach((value) => {
        if (value === normalizedQuery) {
            bestScore = Math.max(bestScore, 150);
            return;
        }
        if (value.startsWith(normalizedQuery)) {
            bestScore = Math.max(bestScore, 120);
            return;
        }
        if (value.includes(normalizedQuery)) {
            bestScore = Math.max(bestScore, 90);
            return;
        }
        if (isSequentialMatch(normalizedQuery.replace(/\s+/g, ''), value.replace(/\s+/g, ''))) {
            bestScore = Math.max(bestScore, 55);
        }
    });

    return bestScore;
};

export const CouponsPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { couponId } = useParams<{ couponId: string }>();
    const isCreateRoute = location.pathname.endsWith('/create');
    const isEditRoute = location.pathname.endsWith('/edit');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<CouponsResponse>({});
    const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<CouponFilterStatus>('all');
    const [typeFilter, setTypeFilter] = useState<CouponFilterType>('all');
    const [expiryFilter, setExpiryFilter] = useState<CouponFilterExpiry>('all');
    const [sortBy, setSortBy] = useState<CouponSort>('recent');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [couponsTab, setCouponsTab] = useState<'coupons' | 'redemptions'>('coupons');
    const [redemptionSearch, setRedemptionSearch] = useState('');
    const [redemptionPlanFilter, setRedemptionPlanFilter] = useState('all');
    const [redemptionStatusFilter, setRedemptionStatusFilter] = useState('all');

    const loadCoupons = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await httpClient.get('/api/admin/coupons');
            setData(response.data || {});
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to load coupons.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCoupons();
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 4000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (!error) return;
        const timer = window.setTimeout(() => setError(null), 4000);
        return () => window.clearTimeout(timer);
    }, [error]);

    const availablePlans = Array.isArray(data.available_plans) ? data.available_plans : [];
    const coupons = Array.isArray(data.coupons) ? data.coupons : [];
    const redemptions = Array.isArray(data.redemptions) ? data.redemptions : [];

    const revenueLabel = useMemo(
        () => `Rs ${Number(data?.stats?.revenue_total || 0).toLocaleString('en-IN')}`,
        [data]
    );

    const filteredRedemptions = useMemo(() => {
        const query = redemptionSearch.trim().toLowerCase();
        return redemptions.filter((item) => {
            if (redemptionPlanFilter !== 'all' && (item.plan_id || '').toLowerCase() !== redemptionPlanFilter.toLowerCase()) {
                return false;
            }
            if (redemptionStatusFilter !== 'all' && (item.status || 'success').toLowerCase() !== redemptionStatusFilter.toLowerCase()) {
                return false;
            }
            if (!query) return true;
            return (
                (item.coupon_code || '').toLowerCase().includes(query) ||
                (item.plan_id || '').toLowerCase().includes(query) ||
                (item.currency || '').toLowerCase().includes(query) ||
                (item.status || '').toLowerCase().includes(query) ||
                (item.id || '').toLowerCase().includes(query)
            );
        });
    }, [redemptions, redemptionSearch, redemptionPlanFilter, redemptionStatusFilter]);

    const filteredCoupons = useMemo(() => {
        const normalizedSearch = searchQuery.trim();
        return coupons
            .map((coupon) => ({
                coupon,
                searchScore: scoreCouponSearch(normalizedSearch, coupon)
            }))
            .filter(({ coupon, searchScore }) => {
                if (normalizedSearch && searchScore <= 0) return false;
                if (statusFilter === 'active' && !coupon.active) return false;
                if (statusFilter === 'inactive' && coupon.active) return false;
                if (statusFilter === 'unused' && Number(coupon.redemption_count || 0) > 0) return false;
                if (typeFilter !== 'all' && coupon.type !== typeFilter) return false;
                if (expiryFilter === 'expired' && !isExpiredDate(coupon.expires_at)) return false;
                if (expiryFilter === 'expiring' && !isExpiringSoon(coupon.expires_at)) return false;
                if (expiryFilter === 'scheduled' && !isFutureDate(coupon.expires_at)) return false;
                if (expiryFilter === 'no_expiry' && coupon.expires_at) return false;
                return true;
            })
            .slice()
            .sort((left, right) => {
                if (normalizedSearch && right.searchScore !== left.searchScore) {
                    return right.searchScore - left.searchScore;
                }
                if (sortBy === 'code') {
                    return left.coupon.code.localeCompare(right.coupon.code);
                }
                if (sortBy === 'value') {
                    return Number(right.coupon.value || 0) - Number(left.coupon.value || 0);
                }
                if (sortBy === 'usage') {
                    return Number(right.coupon.redemption_count || 0) - Number(left.coupon.redemption_count || 0);
                }
                if (sortBy === 'expiry') {
                    const leftValue = left.coupon.expires_at ? new Date(left.coupon.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
                    const rightValue = right.coupon.expires_at ? new Date(right.coupon.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
                    return leftValue - rightValue;
                }
                const leftValue = new Date(left.coupon.updated_at || left.coupon.created_at || 0).getTime();
                const rightValue = new Date(right.coupon.updated_at || right.coupon.created_at || 0).getTime();
                return rightValue - leftValue;
            })
            .map(({ coupon }) => coupon);
    }, [coupons, expiryFilter, searchQuery, sortBy, statusFilter, typeFilter]);

    const resetForm = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const setField = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const togglePlan = (planId: string) => {
        setForm((current) => ({
            ...current,
            plan_ids: current.plan_ids.includes(planId)
                ? current.plan_ids.filter((id) => id !== planId)
                : [...current.plan_ids, planId]
        }));
    };

    const toggleBillingCycle = (cycle: 'monthly' | 'yearly') => {
        setForm((current) => {
            const hasCycle = current.billing_cycle_targets.includes(cycle);
            const nextCycles = hasCycle
                ? current.billing_cycle_targets.filter((entry) => entry !== cycle)
                : [...current.billing_cycle_targets, cycle];
            return {
                ...current,
                billing_cycle_targets: nextCycles.length > 0 ? nextCycles : ['monthly', 'yearly']
            };
        });
    };

    const startEditing = (coupon: CouponRecord) => {
        setEditingId(coupon.id);
        setForm(mapCouponToForm(coupon));
        setNotice(null);
        setError(null);
        navigate(`/coupons/${coupon.id}/edit`);
    };

    useEffect(() => {
        if (isCreateRoute) {
            setEditingId(null);
            setForm(EMPTY_FORM);
            return;
        }
        if (!couponId) {
            return;
        }
        const matched = coupons.find((coupon) => coupon.id === couponId);
        if (matched) {
            setEditingId(matched.id);
            setForm(mapCouponToForm(matched));
        }
    }, [couponId, coupons, isCreateRoute]);

    const submitCoupon = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            const payload = buildPayload(form);
            if (payload.expires_at && new Date(payload.expires_at).getTime() < Date.now()) {
                throw new Error('Expiry date must be today or in the future.');
            }
            if (editingId) {
                await httpClient.patch(`/api/admin/coupons/${editingId}`, payload);
                setNotice(`Coupon ${payload.code} updated.`);
            } else {
                const response = await httpClient.post('/api/admin/coupons', payload);
                const createdCount = Number(response?.data?.created_count || 1);
                setNotice(createdCount > 1
                    ? `${createdCount} coupons created with prefix ${payload.code}.`
                    : `Coupon ${payload.code} created.`);
            }
            await loadCoupons();
            resetForm();
            navigate('/coupons');
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to save coupon.');
        } finally {
            setSaving(false);
        }
    };

    const toggleCouponStatus = async (coupon: CouponRecord) => {
        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            await httpClient.patch(`/api/admin/coupons/${coupon.id}`, {
                active: !coupon.active
            });
            await loadCoupons();
            setNotice(`Coupon ${coupon.code} ${coupon.active ? 'disabled' : 'activated'}.`);
            if (editingId === coupon.id) {
                setForm((current) => ({ ...current, active: !coupon.active }));
            }
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to update coupon status.');
        } finally {
            setSaving(false);
        }
    };

    const copyCouponCode = async (code: string) => {
        const normalizedCode = String(code || '').trim();
        if (!normalizedCode) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(normalizedCode);
            } else {
                const temp = document.createElement('textarea');
                temp.value = normalizedCode;
                temp.style.position = 'fixed';
                temp.style.opacity = '0';
                document.body.appendChild(temp);
                temp.focus();
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }
            setCopiedCode(normalizedCode);
            setNotice(`Copied ${normalizedCode}.`);
            window.setTimeout(() => {
                setCopiedCode((current) => current === normalizedCode ? null : current);
            }, 1800);
        } catch {
            setError(`Could not copy ${normalizedCode}.`);
        }
    };

    const editorMode = isCreateRoute || isEditRoute;
    const editorTitle = editingId ? 'Edit Coupon' : 'Create Coupon';
    const editorDescription = editingId
        ? 'Update code rules, limits, plan targeting, and redemption settings without leaving the coupons section.'
        : 'Launch a new coupon with clear targeting, expiry, and usage controls in a dedicated admin workflow.';

    const editorForm = (
        <form onSubmit={submitCoupon} className="glass-card ig-topline rounded-[32px] p-6">
            <div className="flex items-start gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-foreground">{editorTitle}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{editorDescription}</p>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="text-[10px] font-black text-muted-foreground">
                        {editingId ? 'Coupon Code' : Number(form.bulk_count || 1) > 1 ? 'Coupon Prefix' : 'Coupon Code'}
                    </label>
                    <input
                        value={form.code}
                        onChange={(event) => setField('code', event.target.value.toUpperCase())}
                        placeholder={editingId ? 'WELCOME20' : Number(form.bulk_count || 1) > 1 ? 'WELCOME' : 'WELCOME20'}
                        className="input-base mt-2"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-muted-foreground">Discount Type</label>
                    <div className="segmented-control mt-2">
                        {[
                            { value: 'percent', label: 'Percent' },
                            { value: 'fixed', label: 'Fixed' }
                        ].map((option) => {
                            const active = form.type === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setField('type', option.value as CouponForm['type'])}
                                    className={`segmented-option ${active ? 'is-active' : ''}`}
                                >
                                    <span className="segmented-dot" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-muted-foreground">Value</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.value}
                        onChange={(event) => setField('value', event.target.value)}
                        placeholder={form.type === 'percent' ? '20' : '499'}
                        className="input-base mt-1.5"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-muted-foreground">Expiry</label>
                    <input
                        type="datetime-local"
                        value={form.expires_at}
                        onChange={(event) => setField('expires_at', event.target.value)}
                        className="input-base mt-1.5"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-muted-foreground">Billing cycle targeting</label>
                    <div className="segmented-control mt-1.5">
                        {[
                            { value: 'monthly', label: 'Monthly' },
                            { value: 'yearly', label: 'Yearly' }
                        ].map((option) => {
                            const active = form.billing_cycle_targets.includes(option.value);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => toggleBillingCycle(option.value as 'monthly' | 'yearly')}
                                    className={`segmented-option ${active ? 'is-active' : ''}`}
                                >
                                    <span className="segmented-dot" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-muted-foreground">Total Usage Limit</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.usage_limit}
                        onChange={(event) => setField('usage_limit', event.target.value)}
                        placeholder="0 = unlimited"
                        className="input-base mt-1.5"
                    />
                </div>
                {!editingId && (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Bulk Quantity</label>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            step="1"
                            value={form.bulk_count}
                            onChange={(event) => setField('bulk_count', event.target.value)}
                            placeholder="1"
                            className="input-base mt-1.5"
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 shadow-xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Coupon status</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Inactive coupons stay saved but cannot be redeemed.</p>
                    </div>
                    <div className="segmented-control shrink-0">
                        {[
                            { value: true, label: 'Active' },
                            { value: false, label: 'Inactive' }
                        ].map((option) => {
                            const active = form.active === option.value;
                            return (
                                <button
                                    key={String(option.value)}
                                    type="button"
                                    onClick={() => setField('active', option.value)}
                                    className={`segmented-option ${active ? 'is-active' : ''}`}
                                >
                                    <span className="segmented-dot" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 shadow-xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-foreground">One-time per user</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">When enabled, the same user can redeem this coupon only once before it expires.</p>
                    </div>
                    <div className="segmented-control shrink-0">
                        {[
                            { value: true, label: 'Single Use' },
                            { value: false, label: 'Reusable' }
                        ].map((option) => {
                            const active = form.one_time_use === option.value;
                            return (
                                <button
                                    key={String(option.value)}
                                    type="button"
                                    onClick={() => setField('one_time_use', option.value)}
                                    className={`segmented-option ${active ? 'is-active' : ''}`}
                                >
                                    <span className="segmented-dot" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Plan targeting</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Leave empty to allow the coupon on every plan.</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">{form.plan_ids.length || 0} selected</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {availablePlans.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                            No pricing plans were returned by the backend.
                        </div>
                    )}
                    {availablePlans.map((plan) => {
                        const active = form.plan_ids.includes(plan.id);
                        return (
                            <button
                                key={plan.id}
                                type="button"
                                onClick={() => togglePlan(plan.id)}
                                className={active
                                    ? 'rounded-xl bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] px-3.5 py-2 text-left text-xs font-semibold text-white shadow-sm'
                                    : 'rounded-xl border border-border bg-card px-3.5 py-2 text-left text-xs font-medium text-foreground hover:bg-muted'}
                            >
                                {plan.name}
                            </button>
                        );
                    })}
                </div>
            </div>


            <div className="mt-5">
                <label className="text-[10px] font-black text-muted-foreground">User IDs</label>
                <textarea
                    rows={4}
                    value={form.user_ids}
                    onChange={(event) => setField('user_ids', event.target.value)}
                    placeholder="Optional comma-separated Appwrite user ids"
                    className="input-base mt-2 min-h-[110px]"
                />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <TicketPercent className="h-4 w-4" />
                    {editingId
                        ? 'Editing an existing coupon.'
                        : Number(form.bulk_count || 1) > 1
                            ? `Creating ${Number(form.bulk_count || 1)} coupons with the same rules.`
                            : 'Creating a new coupon.'}
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={loadCoupons}
                        className="btn-secondary px-4 py-3 text-[10px]"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary px-5 py-3 text-[10px] disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {editingId
                            ? 'Update Coupon'
                            : Number(form.bulk_count || 1) > 1
                                ? 'Create Bulk Coupons'
                                : 'Create Coupon'}
                    </button>
                </div>
            </div>
        </form>
    );

    if (loading) {
        return <AdminLoadingState title="Loading coupons" description="Preparing coupon codes, targeting rules, and redemption activity." />;
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-700">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <p className="text-[10px] font-black text-muted-foreground">Billing Operations</p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                        {editorMode ? editorTitle : 'Coupons & Redemptions'}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        {editorMode
                            ? editorDescription
                            : 'Create promo codes, target plans, manage expiration, and verify recent redemption activity in one place.'}
                    </p>
                </div>
                {editorMode ? (
                    <Link
                        to="/coupons"
                        onClick={() => resetForm()}
                        className="btn-secondary px-5 py-3 text-xs"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        List
                    </Link>
                ) : (
                    <Link to="/coupons/create" className="btn-primary px-6 py-3 text-xs shadow-[0_18px_44px_rgba(131,58,180,0.26)]">
                        <Plus className="h-4 w-4" />
                        Create Coupon
                    </Link>
                )}
            </div>

            {(error || notice) && (
                <div className={cn(
                    'glass-card rounded-[24px] px-5 py-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300',
                    error ? 'border-destructive/25 text-destructive' : 'border-success/25 text-success'
                )}>
                    <div className="inline-flex items-center gap-2 font-semibold">
                        {error ? null : <CheckCircle2 className="h-4 w-4" />}
                        {error || notice}
                    </div>
                </div>
            )}

            {!editorMode && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    { label: 'Total Coupons', value: data?.stats?.coupons_total || 0, icon: TicketPercent, tone: 'text-primary' },
                    { label: 'Active Codes', value: data?.stats?.active_coupons || 0, icon: CheckCircle2, tone: 'text-emerald-500' },
                    { label: 'Redemptions', value: data?.stats?.redemptions_total || 0, icon: Layers, tone: 'text-amber-500' },
                    { label: 'Gross Revenue', value: revenueLabel, icon: Sparkles, tone: 'text-violet-500' }
                ].map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <div className={cn('rounded-xl bg-muted/60 p-2.5 transition-colors group-hover:bg-primary/10', tone)}>
                                <Icon className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{value}</p>
                    </div>
                ))}
            </div>
            )}

            {editorMode ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
                    {editorForm}

                    <div className="space-y-6">
                        {/* Live Voucher Ticket Preview */}
                        <div className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-primary">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Live Voucher Preview
                                </span>
                                <span className={cn(
                                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                                    form.active
                                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : 'border border-border bg-muted text-muted-foreground'
                                )}>
                                    {form.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            {/* Ticket Stub */}
                            <div className="relative mt-4 overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-background/90 p-5 shadow-xs backdrop-blur-xs">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-xl font-black tracking-wider text-foreground">
                                            {form.code || (editingId ? 'COUPON' : Number(form.bulk_count || 1) > 1 ? 'PREFIX-XXXX' : 'CODE')}
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-primary">
                                            {form.type === 'percent'
                                                ? `${form.value || '0'}% OFF`
                                                : `Rs ${Number(form.value || 0).toLocaleString('en-IN')} OFF`}
                                        </p>
                                    </div>
                                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                        <Tag className="h-5 w-5" />
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-dashed border-border/70 pt-3 text-[10px] font-medium text-muted-foreground">
                                    <span className="rounded-md bg-muted px-2 py-0.5">
                                        {form.one_time_use ? 'Single use per user' : 'Reusable'}
                                    </span>
                                    <span className="rounded-md bg-muted px-2 py-0.5">
                                        Cycles: {form.billing_cycle_targets.join(' + ')}
                                    </span>
                                    {form.plan_ids.length > 0 && (
                                        <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                                            {form.plan_ids.length} selected plan{form.plan_ids.length === 1 ? '' : 's'}
                                        </span>
                                    )}
                                    {form.expires_at ? (
                                        <span className="rounded-md bg-muted px-2 py-0.5">
                                            Exp: {new Date(form.expires_at).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <span className="rounded-md bg-muted px-2 py-0.5">No expiration</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                            <p className="text-xs font-semibold text-primary">Workflow</p>
                            <h2 className="mt-2 text-xl font-bold text-foreground">Coupon publishing guide</h2>
                            <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
                                <p>Use a clear code or prefix, confirm the discount type, then decide whether the coupon should be reusable or single-use.</p>
                                <p>Leave plan targeting empty to make the offer available everywhere, or pin it to selected plans for campaign-specific pricing.</p>
                                <p>After saving, the coupon returns to the live list immediately so you can verify status, copy the code, and monitor redemption activity.</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-primary">Overview</p>
                                    <h2 className="mt-1 text-xl font-bold text-foreground">Current coupon health</h2>
                                </div>
                                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{data?.stats?.active_coupons || 0} active</span>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-2.5">
                                {[
                                    ['Coupons total', data?.stats?.coupons_total || 0],
                                    ['Redemptions', data?.stats?.redemptions_total || 0],
                                    ['Revenue', revenueLabel]
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 shadow-xs">
                                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                        <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-2">
                        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/70 dark:bg-zinc-900/90 border border-border/80 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setCouponsTab('coupons')}
                            className={cn(
                                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
                                couponsTab === 'coupons'
                                    ? 'bg-background dark:bg-zinc-800 text-foreground shadow-xs border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Tag className="h-4 w-4 text-primary" />
                            Coupons Inventory
                            <span className={cn(
                                'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                couponsTab === 'coupons'
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-muted text-muted-foreground'
                            )}>
                                {coupons.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCouponsTab('redemptions')}
                            className={cn(
                                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
                                couponsTab === 'redemptions'
                                    ? 'bg-background dark:bg-zinc-800 text-foreground shadow-xs border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Layers className="h-4 w-4 text-primary" />
                            Redemption History
                            <span className={cn(
                                'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                couponsTab === 'redemptions'
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-muted text-muted-foreground'
                            )}>
                                {redemptions.length}
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={loadCoupons}
                            className="btn-secondary px-3.5 py-2 text-xs font-semibold"
                            title="Refresh Data"
                        >
                            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                            Refresh
                        </button>
                    </div>
                </div>

            <div className="grid grid-cols-1 gap-6">
                {couponsTab === 'coupons' ? (
                <div className="space-y-6">
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Coupon Codes</h2>
                                <p className="mt-1 text-xs text-muted-foreground">Sort live offers, narrow by type or timing, and keep the list contained in one clean panel.</p>
                            </div>
                            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{filteredCoupons.length} shown</span>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-xl border border-border/80 bg-background/50 p-4">
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_auto]">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="Search code, type, or value"
                                            className="input-base pl-10"
                                        />
                                    </div>
                                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card/70 px-4 py-3 text-xs font-black text-muted-foreground">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Live filters
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <SelectField
                                        label="Status"
                                        value={statusFilter}
                                        onChange={(value) => setStatusFilter(value as CouponFilterStatus)}
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="active">Active Only</option>
                                        <option value="inactive">Inactive Only</option>
                                        <option value="unused">Unused Codes</option>
                                    </SelectField>

                                    <SelectField
                                        label="Discount Type"
                                        value={typeFilter}
                                        onChange={(value) => setTypeFilter(value as CouponFilterType)}
                                    >
                                        <option value="all">All Discount Types</option>
                                        <option value="percent">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (Rs)</option>
                                    </SelectField>

                                    <SelectField
                                        label="Timing & Expiry"
                                        value={expiryFilter}
                                        onChange={(value) => setExpiryFilter(value as CouponFilterExpiry)}
                                    >
                                        <option value="all">Any Expiration Date</option>
                                        <option value="expired">Expired Codes</option>
                                        <option value="expiring">Expiring Soon (14d)</option>
                                        <option value="scheduled">Scheduled / Future</option>
                                        <option value="no_expiry">No Expiry Date</option>
                                    </SelectField>

                                    <SelectField
                                        label="Sort By"
                                        value={sortBy}
                                        onChange={(value) => setSortBy(value as CouponSort)}
                                    >
                                        <option value="recent">Recently Created</option>
                                        <option value="expiry">Expiration Date</option>
                                        <option value="value">Highest Discount Value</option>
                                        <option value="usage">Most Redemptions</option>
                                        <option value="code">Alphabetical Code</option>
                                    </SelectField>
                                </div>
                            </div>

                            <div className="space-y-4">
                            {filteredCoupons.length === 0 && (
                                <div className="rounded-[24px] border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
                                    No coupons match the current filter and search criteria.
                                </div>
                            )}

                            {filteredCoupons.map(({ coupon }) => {
                                const usagePercent = coupon.usage_limit > 0
                                    ? Math.min(100, Math.round(((coupon.redemption_count || 0) / coupon.usage_limit) * 100))
                                    : null;
                                const isCopied = copiedCode === coupon.code;

                                return (
                                <div
                                    key={coupon.id}
                                    className={cn(
                                        'group relative overflow-hidden rounded-2xl border transition-all duration-300',
                                        coupon.active
                                            ? 'border-border/80 bg-card hover:border-primary/40 hover:shadow-md'
                                            : 'border-border/40 bg-muted/20 opacity-75 hover:opacity-100'
                                    )}
                                >
                                    {/* Perforated ticket stub divider */}
                                    <div className="pointer-events-none absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-r border-border/80" />
                                    <div className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-l border-border/80" />

                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 pl-7 pr-7">
                                        <div className="space-y-3 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2.5">
                                                <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 font-mono text-base font-black tracking-wider text-foreground">
                                                    <span>{coupon.code}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyCouponCode(coupon.code)}
                                                        className={cn(
                                                            'ml-1 rounded-md p-1 transition-colors',
                                                            isCopied
                                                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                                                : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                                                        )}
                                                        title="Copy coupon code"
                                                    >
                                                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </button>
                                                </div>

                                                <span className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                                    {formatCouponValue(coupon)}
                                                </span>

                                                <span className={cn(
                                                    'status-pill text-[10px] font-bold py-0.5 px-2.5',
                                                    coupon.active ? 'status-pill-success' : 'status-pill-danger'
                                                )}>
                                                    {coupon.active ? 'Active' : 'Disabled'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    {coupon.one_time_use ? 'Single use per user' : 'Reusable'}
                                                </span>
                                                <span className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    Billing: {(coupon.billing_cycle_targets || []).join(' + ') || 'All cycles'}
                                                </span>
                                                <span className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    Plans: {coupon.plan_ids.length > 0 ? `${coupon.plan_ids.length} selected` : 'All plans'}
                                                </span>
                                                {coupon.user_ids.length > 0 && (
                                                    <span className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                                        Users: {coupon.user_ids.length} targeted
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                                <span>
                                                    Expires: {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'Never'}
                                                </span>
                                                <span>
                                                    Redemptions: <strong className="font-semibold text-foreground">{coupon.redemption_count || 0}</strong>
                                                    {coupon.usage_limit > 0 ? ` / ${coupon.usage_limit}` : ' (Unlimited)'}
                                                </span>
                                                {usagePercent !== null && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                                            <div
                                                                className="h-full rounded-full bg-primary transition-all"
                                                                style={{ width: `${usagePercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold">{usagePercent}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2 pt-2 lg:pt-0">
                                            <button
                                                type="button"
                                                onClick={() => startEditing(coupon)}
                                                className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
                                            >
                                                <PencilLine className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleCouponStatus(coupon)}
                                                className={cn(
                                                    'inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
                                                    coupon.active
                                                        ? 'border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20'
                                                        : 'btn-primary'
                                                )}
                                            >
                                                {coupon.active ? 'Disable' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                            </div>
                        </div>
                    </div>
                </div>
                ) : (
                /* REDEMPTION HISTORY TAB */
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Redemption History & Audit</h2>
                            <p className="mt-1 text-xs text-muted-foreground">Comprehensive transaction ledger of discount coupons applied during subscriber checkout.</p>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {filteredRedemptions.length} records found
                        </span>
                    </div>

                    {/* Search & Filters for Redemptions */}
                    <div className="rounded-xl border border-border/80 bg-background/50 p-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={redemptionSearch}
                                    onChange={(event) => setRedemptionSearch(event.target.value)}
                                    placeholder="Search coupon, plan, currency..."
                                    className="input-base pl-10"
                                />
                            </div>
                            <SelectField
                                label="Target Plan"
                                value={redemptionPlanFilter}
                                onChange={(val) => setRedemptionPlanFilter(val)}
                            >
                                <option value="all">All Plans</option>
                                {availablePlans.map((p) => (
                                    <option key={p.id} value={p.plan_code || p.id}>
                                        {p.name || p.plan_code}
                                    </option>
                                ))}
                            </SelectField>
                            <SelectField
                                label="Redemption Status"
                                value={redemptionStatusFilter}
                                onChange={(val) => setRedemptionStatusFilter(val)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="success">Success</option>
                                <option value="completed">Completed</option>
                                <option value="pending">Pending</option>
                                <option value="failed">Failed</option>
                            </SelectField>
                        </div>
                    </div>

                    {/* Table for Desktop */}
                    <div className="hidden md:block overflow-hidden rounded-xl border border-border/80 bg-background/30">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    <th className="px-5 py-3.5">Coupon Code</th>
                                    <th className="px-5 py-3.5">Target Plan</th>
                                    <th className="px-5 py-3.5">Final Amount</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Redeemed At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filteredRedemptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                                            <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                                            No redemptions match your query.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRedemptions.map((item) => (
                                        <tr key={item.id} className="transition-colors hover:bg-muted/30">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-foreground bg-primary/10 border border-primary/20 rounded-md px-2 py-1">
                                                        {item.coupon_code || 'N/A'}
                                                    </span>
                                                    {item.coupon_code && (
                                                        <button
                                                            type="button"
                                                            onClick={() => copyCouponCode(item.coupon_code)}
                                                            className="text-muted-foreground hover:text-foreground transition p-1"
                                                            title="Copy code"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-1 text-xs font-semibold text-foreground capitalize">
                                                    {item.plan_id || 'Global'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-mono text-xs font-bold text-foreground">
                                                    {item.currency || 'INR'} {Number(item.final_amount || 0).toLocaleString('en-IN')}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    'status-pill text-[10px] font-bold py-0.5 px-2.5',
                                                    item.status === 'failed' ? 'status-pill-danger' : 'status-pill-success'
                                                )}>
                                                    {item.status || 'Success'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                                                {item.created_at ? (
                                                    <span>
                                                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : 'Unknown'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Cards for Mobile */}
                    <div className="block md:hidden divide-y divide-border/60">
                        {filteredRedemptions.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                <Receipt className="mx-auto h-7 w-7 text-muted-foreground/50 mb-2" />
                                No redemptions found.
                            </div>
                        ) : (
                            filteredRedemptions.map((item) => (
                                <div key={item.id} className="py-4 space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-mono text-xs font-bold text-foreground bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5">
                                            {item.coupon_code || 'N/A'}
                                        </span>
                                        <span className={cn(
                                            'status-pill text-[10px] font-bold py-0.5 px-2',
                                            item.status === 'failed' ? 'status-pill-danger' : 'status-pill-success'
                                        )}>
                                            {item.status || 'Success'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Plan: <strong className="text-foreground font-semibold">{item.plan_id || 'Global'}</strong></span>
                                        <span className="font-mono font-bold text-foreground">
                                            {item.currency || 'INR'} {item.final_amount}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown'}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                )}
            </div>
            </div>
            )}
        </div>
    );
};

export default CouponsPage;
