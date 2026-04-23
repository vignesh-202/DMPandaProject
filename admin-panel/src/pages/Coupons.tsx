import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Copy, Loader2, PencilLine, Plus, RefreshCcw, Search, SlidersHorizontal, TicketPercent } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';

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

type CouponFilterStatus = 'all' | 'active' | 'inactive';
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

    const availablePlans = Array.isArray(data.available_plans) ? data.available_plans : [];
    const coupons = Array.isArray(data.coupons) ? data.coupons : [];
    const redemptions = Array.isArray(data.redemptions) ? data.redemptions : [];

    const revenueLabel = useMemo(
        () => `Rs ${Number(data?.stats?.revenue_total || 0).toLocaleString('en-IN')}`,
        [data]
    );

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
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
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
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Discount Type</label>
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
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Value</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.value}
                        onChange={(event) => setField('value', event.target.value)}
                        placeholder={form.type === 'percent' ? '20' : '499'}
                        className="input-base mt-2"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Expiry</label>
                    <input
                        type="datetime-local"
                        value={form.expires_at}
                        onChange={(event) => setField('expires_at', event.target.value)}
                        className="input-base mt-2"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Billing cycle targeting</label>
                    <div className="segmented-control mt-2">
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
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Total Usage Limit</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.usage_limit}
                        onChange={(event) => setField('usage_limit', event.target.value)}
                        placeholder="0 = unlimited"
                        className="input-base mt-2"
                    />
                </div>
                {!editingId && (
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Bulk Quantity</label>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            step="1"
                            value={form.bulk_count}
                            onChange={(event) => setField('bulk_count', event.target.value)}
                            placeholder="1"
                            className="input-base mt-2"
                        />
                    </div>
                )}
            </div>

            <div className="mt-5 rounded-[28px] border border-border/80 bg-background/40 p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-bold text-foreground">Coupon status</p>
                        <p className="mt-1 text-xs text-muted-foreground">Inactive coupons stay saved but cannot be redeemed.</p>
                    </div>
                    <div className="segmented-control">
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

            <div className="mt-5 rounded-[28px] border border-border/80 bg-background/40 p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-bold text-foreground">One-time per user</p>
                        <p className="mt-1 text-xs text-muted-foreground">When enabled, the same user can redeem this coupon only once before it expires.</p>
                    </div>
                    <div className="segmented-control">
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

            <div className="mt-5 rounded-[28px] border border-border/80 bg-background/40 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-foreground">Plan targeting</p>
                        <p className="mt-1 text-xs text-muted-foreground">Leave empty to allow the coupon on every plan.</p>
                    </div>
                    <span className="status-pill status-pill-warning">{form.plan_ids.length || 0} selected</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {availablePlans.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
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
                                    ? 'rounded-2xl bg-ig-gradient px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em] text-white shadow-card'
                                    : 'rounded-2xl border border-border bg-card px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em] text-foreground'}
                            >
                                <span className="block">{plan.name}</span>
                                <span className={`mt-1 block text-[10px] ${active ? 'text-white/70' : 'text-muted-foreground'}`}>
                                    {plan.plan_code || plan.id}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-5">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">User IDs</label>
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
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">Billing Operations</p>
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
                <div className={`glass-card rounded-[24px] px-5 py-4 text-sm ${error ? 'border-destructive/25 text-destructive' : 'border-success/25 text-success'}`}>
                    <div className="inline-flex items-center gap-2 font-semibold">
                        {error ? null : <CheckCircle2 className="h-4 w-4" />}
                        {error || notice}
                    </div>
                </div>
            )}

            {!editorMode && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[
                    ['Coupons', data?.stats?.coupons_total || 0],
                    ['Active', data?.stats?.active_coupons || 0],
                    ['Redemptions', data?.stats?.redemptions_total || 0],
                    ['Revenue', revenueLabel]
                ].map(([label, value]) => (
                    <div key={String(label)} className="glass-card rounded-[28px] p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
                        <p className="mt-4 text-3xl font-extrabold text-foreground">{value}</p>
                    </div>
                ))}
            </div>
            )}

            {editorMode ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                    {editorForm}

                    <div className="space-y-6">
                        <div className="glass-card rounded-[32px] p-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Workflow</p>
                            <h2 className="mt-3 text-2xl font-extrabold text-foreground">Coupon publishing guide</h2>
                            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
                                <p>Use a clear code or prefix, confirm the discount type, then decide whether the coupon should be reusable or single-use.</p>
                                <p>Leave plan targeting empty to make the offer available everywhere, or pin it to selected plans for campaign-specific pricing.</p>
                                <p>After saving, the coupon returns to the live list immediately so you can verify status, copy the code, and monitor redemption activity.</p>
                            </div>
                        </div>

                        <div className="glass-card rounded-[32px] p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Overview</p>
                                    <h2 className="mt-3 text-2xl font-extrabold text-foreground">Current coupon health</h2>
                                </div>
                                <span className="status-pill status-pill-success">{data?.stats?.active_coupons || 0} active</span>
                            </div>
                            <div className="mt-5 grid grid-cols-1 gap-3">
                                {[
                                    ['Coupons total', data?.stats?.coupons_total || 0],
                                    ['Redemptions', data?.stats?.redemptions_total || 0],
                                    ['Revenue', revenueLabel]
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-[24px] border border-border/80 bg-background/40 px-4 py-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                                        <p className="mt-2 text-xl font-extrabold text-foreground">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
            <div className="grid grid-cols-1 gap-6">

                <div className="space-y-6">
                    <div className="glass-card rounded-[32px] p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-extrabold text-foreground">Coupon Codes</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Sort live offers, narrow by type or timing, and keep the list contained in one clean panel.</p>
                            </div>
                            <span className="status-pill status-pill-success">{filteredCoupons.length} shown</span>
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-[24px] border border-border/80 bg-background/50 p-4">
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
                                    <div className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card/70 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Live filters
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                        <div className="segmented-control-panel mt-2">
                                            {[
                                                { value: 'all', label: 'All' },
                                                { value: 'active', label: 'Active' },
                                                { value: 'inactive', label: 'Inactive' }
                                            ].map((option) => {
                                                const active = statusFilter === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setStatusFilter(option.value as CouponFilterStatus)}
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
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Discount</p>
                                        <div className="segmented-control-panel mt-2">
                                            {[
                                                { value: 'all', label: 'All' },
                                                { value: 'percent', label: 'Percentage' },
                                                { value: 'fixed', label: 'Fixed' }
                                            ].map((option) => {
                                                const active = typeFilter === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setTypeFilter(option.value as CouponFilterType)}
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
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Timing</p>
                                        <div className="segmented-control-panel mt-2">
                                            {[
                                                { value: 'all', label: 'Any Date' },
                                                { value: 'expired', label: 'Expired' },
                                                { value: 'expiring', label: 'Expiring Soon' },
                                                { value: 'scheduled', label: 'Scheduled' },
                                                { value: 'no_expiry', label: 'No Expiry' }
                                            ].map((option) => {
                                                const active = expiryFilter === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setExpiryFilter(option.value as CouponFilterExpiry)}
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
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Sort</p>
                                        <div className="segmented-control-panel mt-2">
                                            {[
                                                { value: 'recent', label: 'Recent' },
                                                { value: 'expiry', label: 'Expiry' },
                                                { value: 'value', label: 'Value' },
                                                { value: 'usage', label: 'Usage' },
                                                { value: 'code', label: 'Code' }
                                            ].map((option) => {
                                                const active = sortBy === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setSortBy(option.value as CouponSort)}
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
                            </div>

                            <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                            {filteredCoupons.length === 0 && (
                                <div className="rounded-[24px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                                    No coupons match the current filters.
                                </div>
                            )}
                            {filteredCoupons.map((coupon) => (
                                <div key={coupon.id} className="rounded-[24px] border border-border/80 bg-background/40 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <p className="text-lg font-extrabold text-foreground">{coupon.code}</p>
                                                <span className={coupon.active ? 'status-pill status-pill-success' : 'status-pill status-pill-danger'}>
                                                    {coupon.active ? 'Active' : 'Inactive'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyCouponCode(coupon.code)}
                                                    className="btn-secondary px-3 py-2 text-[10px]"
                                                >
                                                    {copiedCode === coupon.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                    {copiedCode === coupon.code ? 'Copied' : 'Copy'}
                                                </button>
                                            </div>
                                            <p className="mt-2 text-sm text-muted-foreground">
                                                {formatCouponValue(coupon)}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    {coupon.type === 'percent' ? 'Percentage' : 'Fixed amount'}
                                                </span>
                                                <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    {coupon.one_time_use ? 'Single use' : 'Reusable'}
                                                </span>
                                                <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    Billing: {(coupon.billing_cycle_targets || ['monthly', 'yearly']).join(' + ')}
                                                </span>
                                                <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    Plans: {coupon.plan_ids.length > 0 ? coupon.plan_ids.length : 'All'}
                                                </span>
                                                <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                                    Users: {coupon.user_ids.length > 0 ? coupon.user_ids.length : 'Any'}
                                                </span>
                                            </div>
                                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                                <p>
                                                    Expires: {coupon.expires_at ? new Date(coupon.expires_at).toLocaleString() : 'No expiration'} ({coupon.timing_status || 'no_expiry'})
                                                </p>
                                                <p>
                                                    Uses: {coupon.redemption_count || 0} / {coupon.usage_limit > 0 ? coupon.usage_limit : 'Unlimited'}
                                                </p>
                                                <p>
                                                    Updated: {coupon.updated_at ? new Date(coupon.updated_at).toLocaleDateString() : 'Unknown'}
                                                </p>
                                                <p>
                                                    Created: {coupon.created_at ? new Date(coupon.created_at).toLocaleDateString() : 'Unknown'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => startEditing(coupon)}
                                                className="btn-secondary px-4 py-2 text-[10px]"
                                            >
                                                <PencilLine className="h-4 w-4" />
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleCouponStatus(coupon)}
                                                className="btn-primary px-4 py-2 text-[10px]"
                                            >
                                                {coupon.active ? 'Disable' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-[32px] p-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-foreground">Recent Redemptions</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Latest successful coupon usage from live billing activity.</p>
                        </div>
                        <div className="mt-5 space-y-3">
                            {redemptions.length === 0 && (
                                <div className="rounded-[24px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                                    No coupon redemptions recorded yet.
                                </div>
                            )}
                            {redemptions.map((item) => (
                                <div key={item.id} className="rounded-[24px] border border-border/80 bg-background/40 px-4 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{item.coupon_code || 'No coupon code'}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {item.plan_id || 'Plan not set'} | {item.currency || 'INR'} | {item.status || 'success'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-extrabold text-foreground">{item.final_amount}</p>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};

export default CouponsPage;
