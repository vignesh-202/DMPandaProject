import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Ban,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ExternalLink,
    Instagram,
    Loader2,
    Search,
    Settings2,
    Shield,
    Trash2,
    X,
    Copy,
    Check,
    Users as UsersIcon,
    CreditCard,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    RotateCcw
} from 'lucide-react';
import httpClient from '../lib/httpClient';
import { cn } from '../lib/utils';
import AdminLoadingState from '../components/AdminLoadingState';
import ConfirmDialog from '../components/ConfirmDialog';
import { loadCachedResource } from '../lib/resourceCache';
import { useAuth } from '../context/AuthContext';
import { SelectField } from '../components/ui/SelectField';

interface UserRow {
    $id: string;
    name: string;
    email: string;
    ban_mode?: string;
    ban_reason?: string;
    $createdAt: string;
    profile?: any;
    linked_instagram_accounts?: number;
}

interface UsersResponse {
    users: UserRow[];
    pagination: {
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
    };
}

interface PricingPlanOption {
    id: string;
    name: string;
    plan_code: string;
    instagram_connections_limit?: number;
    actions_per_hour_limit?: number;
    actions_per_day_limit?: number;
    actions_per_month_limit?: number;
    entitlements?: Record<string, boolean>;
    benefits?: Array<{ key: string; enabled: boolean }>;
}

const formatExpiryLabel = (value?: string | null) => {
    if (!value) return 'No expiry';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'No expiry' : parsed.toLocaleString();
};

const getInstagramTokenValidity = (value?: string | null) => {
    if (!value) {
        return {
            tone: 'neutral' as const,
            label: 'Unknown',
            detail: 'Token expiry not set'
        };
    }

    const expiresAt = new Date(value);
    const expiresMs = expiresAt.getTime();
    if (Number.isNaN(expiresMs)) {
        return {
            tone: 'neutral' as const,
            label: 'Unknown',
            detail: 'Invalid expiry format'
        };
    }

    const diffMs = expiresMs - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs <= 0) {
        return {
            tone: 'danger' as const,
            label: 'Expired',
            detail: `Expired ${formatExpiryLabel(value)}`
        };
    }

    if (diffDays <= 7) {
        return {
            tone: 'warning' as const,
            label: `${diffDays}d left`,
            detail: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`
        };
    }

    return {
        tone: 'success' as const,
        label: 'Healthy',
        detail: `${diffDays} days remaining`
    };
};

const deriveSubscriptionSummary = (payload: any, previous: any = null) => {
    const explicit = payload?.subscription_summary;
    if (explicit && typeof explicit === 'object') {
        return explicit;
    }

    const profile = payload?.profile || previous?.profile || {};
    const effectivePlan = payload?.effective_plan || previous?.effective_plan || {};
    const fallbackPlanCode = String(
        effectivePlan?.plan_code
        || profile?.plan_code
        || previous?.subscription_summary?.plan_code
        || 'free'
    ).trim().toLowerCase() || 'free';
    const rawExpiry = payload?.expiry_date
        || profile?.expiry_date
        || previous?.subscription_summary?.expiry_date
        || null;
    const normalizedExpiry = rawExpiry ? new Date(rawExpiry) : null;
    const expiryDate = normalizedExpiry && !Number.isNaN(normalizedExpiry.getTime())
        ? normalizedExpiry.toISOString()
        : null;
    const isFree = fallbackPlanCode === 'free';
    const isActive = !isFree && Boolean(expiryDate && new Date(expiryDate).getTime() > Date.now());
    const isExpired = !isFree && Boolean(expiryDate && new Date(expiryDate).getTime() <= Date.now());

    return {
        plan_code: fallbackPlanCode,
        expiry_date: expiryDate,
        plan_source: payload?.plan_source || profile?.plan_source || previous?.subscription_summary?.plan_source || 'system',
        derived_status: isActive ? 'active' : (isExpired ? 'expired' : 'inactive'),
        is_active: isActive,
        is_expired: isExpired
    };
};

type PopupSectionKey = 'instagram' | 'ban' | 'danger';

const DEFAULT_POPUP_SECTION_STATE: Record<PopupSectionKey, boolean> = {
    instagram: true,
    ban: false,
    danger: false
};

export const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const { userId } = useParams<{ userId: string }>();

    const [users, setUsers] = useState<UserRow[]>([]);
    const [pricingPlans, setPricingPlans] = useState<PricingPlanOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedUsersOnce, setHasLoadedUsersOnce] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({
        plan: '',
        subscription_status: '',
        ban_mode: '',
        linked_ig_min: '',
        linked_ig_max: ''
    });
    const [pagination, setPagination] = useState<UsersResponse['pagination']>({
        page: 1,
        page_size: 20,
        total: 0,
        total_pages: 1,
        has_next: false,
        has_previous: false
    });
    const { user: currentAdminUser } = useAuth();
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);
    const [banMode, setBanMode] = useState<'none' | 'soft' | 'hard'>('none');
    const [banReason, setBanReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [accountToggleLoadingId, setAccountToggleLoadingId] = useState<string | null>(null);
    const [openingDashboard, setOpeningDashboard] = useState(false);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [showBanConfirmDialog, setShowBanConfirmDialog] = useState(false);
    const [banConfirmText, setBanConfirmText] = useState('');
    const [showDeleteInstagramDialog, setShowDeleteInstagramDialog] = useState(false);
    const [deleteInstagramConfirmText, setDeleteInstagramConfirmText] = useState('');
    const [pendingDeleteInstagramAccount, setPendingDeleteInstagramAccount] = useState<any | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [popupSections, setPopupSections] = useState<Record<PopupSectionKey, boolean>>(DEFAULT_POPUP_SECTION_STATE);
    const [copiedEmail, setCopiedEmail] = useState(false);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 4000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (!errorMessage) return;
        const timer = window.setTimeout(() => setErrorMessage(null), 4000);
        return () => window.clearTimeout(timer);
    }, [errorMessage]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setPagination((current) => ({ ...current, page: 1 }));
        }, 280);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const fetchPricingPlans = async () => {
        try {
            const response = await loadCachedResource('admin:pricing:plans', () => httpClient.get('/api/admin/pricing'), 30000);
            setPricingPlans(Array.isArray(response.data?.plans) ? response.data.plans : []);
        } catch (error) {
            console.error('Failed to load pricing plans:', error);
        }
    };

    const fetchUsers = async (page = pagination.page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                page_size: String(pagination.page_size)
            });

            if (debouncedSearch) params.set('search', debouncedSearch);
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });

            const response = await httpClient.get(`/api/admin/users?${params.toString()}`);
            setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
            if (response.data?.pagination) {
                setPagination(response.data.pagination);
            }
            setErrorMessage(null);
        } catch (error) {
            console.error('Error fetching users:', error);
            setErrorMessage('Failed to load users.');
        } finally {
            setHasLoadedUsersOnce(true);
            setLoading(false);
        }
    };

    const loadUserDetail = async (targetUserId: string) => {
        setDetailLoading(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.get(`/api/admin/users/${targetUserId}`);
            setDetailData(response.data);
            setBanMode(String(response.data?.user?.ban_mode || 'none') as 'none' | 'soft' | 'hard');
            setBanReason(response.data?.user?.ban_reason || '');
        } catch (error) {
            console.error('Error loading user detail:', error);
            setErrorMessage('Failed to load user details.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        void fetchPricingPlans();
    }, []);

    useEffect(() => {
        void fetchUsers(1);
    }, [debouncedSearch, filters.plan, filters.subscription_status, filters.ban_mode, filters.linked_ig_min, filters.linked_ig_max]);

    useEffect(() => {
        if (!userId) {
            setDetailData(null);
            setPopupSections(DEFAULT_POPUP_SECTION_STATE);
            return;
        }
        setPopupSections(DEFAULT_POPUP_SECTION_STATE);
        void loadUserDetail(userId);
    }, [userId]);

    const selectedUser = useMemo(
        () => users.find((entry) => entry.$id === userId) || detailData?.user || null,
        [detailData?.user, userId, users]
    );

    const isTargetSelfOrAdmin = useMemo(() => {
        if (!selectedUser) return false;
        const targetId = selectedUser.$id;
        const currentId = currentAdminUser?.$id;
        const isSelf = Boolean(currentId && targetId === currentId);
        const isTargetAdmin = Boolean(
            (selectedUser as any)?.labels?.includes('admin') ||
            (detailData?.user as any)?.labels?.includes('admin')
        );
        return isSelf || isTargetAdmin;
    }, [selectedUser, currentAdminUser, detailData]);

    const closeModal = () => navigate('/users');
    const togglePopupSection = (section: PopupSectionKey) => {
        setPopupSections((prev) => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const mergeDetailData = (payload: any) => {
        setDetailData((prev: any) => {
            if (!prev) return prev;
            const nextSubscriptionSummary = deriveSubscriptionSummary(payload, prev);
            const nextEffectiveLimits = payload?.effective_limits || prev.effective_limits;
            return {
                ...prev,
                ...(payload || {}),
                user: payload?.user || prev.user,
                profile: payload?.profile || prev.profile,
                instagram_accounts: Array.isArray(payload?.instagram_accounts) ? payload.instagram_accounts : prev.instagram_accounts,
                total_linked_accounts: payload?.total_linked_accounts ?? prev.total_linked_accounts,
                max_allowed_accounts: payload?.max_allowed_accounts ?? prev.max_allowed_accounts,
                active_account_limit: payload?.active_account_limit ?? nextEffectiveLimits?.active_account_limit ?? prev.active_account_limit,
                effective_limits: nextEffectiveLimits,
                effective_plan: payload?.effective_plan || prev.effective_plan,
                subscription_summary: nextSubscriptionSummary
            };
        });
    };

    const saveBan = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.post(`/api/admin/users/${selectedUser.$id}/ban`, {
                mode: banMode,
                reason: banReason
            });
            const result = response.data?.data || {};
            mergeDetailData({ user: result.user || detailData?.user });
            setUsers((prev) => prev.map((entry) => entry.$id === selectedUser.$id ? {
                ...entry,
                ban_mode: result?.user?.ban_mode ?? entry.ban_mode,
                ban_reason: result?.user?.ban_reason ?? entry.ban_reason
            } : entry));
            setShowBanConfirmDialog(false);
            setNotice('Ban status updated.');
        } catch (error: any) {
            console.error('Failed to update ban status:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to update ban status.');
        } finally {
            setSaving(false);
        }
    };

    const toggleInstagramAccountAccess = async (account: any) => {
        if (!selectedUser || !account?.$id) return;
        setAccountToggleLoadingId(account.$id);
        setErrorMessage(null);
        try {
            const enabling = String(account?.admin_status || '').trim().toLowerCase() !== 'active';
            const response = await httpClient.patch(`/api/admin/users/${selectedUser.$id}/instagram-accounts/${account.$id}`, {
                status: enabling ? 'active' : 'inactive'
            });
            const result = response.data?.data || {};
            if (Array.isArray(result?.instagram_accounts)) {
                mergeDetailData(result);
                setUsers((prev) => prev.map((entry) => entry.$id === selectedUser.$id ? {
                    ...entry,
                    linked_instagram_accounts: Number(result?.total_linked_accounts ?? entry.linked_instagram_accounts ?? 0)
                } : entry));
            } else {
                setDetailData((prev: any) => {
                    if (!prev) return prev;
                    const currentAccounts = Array.isArray(prev.instagram_accounts) ? prev.instagram_accounts : [];
                    return {
                        ...prev,
                        instagram_accounts: currentAccounts.map((entry: any) => (
                            entry?.$id === account.$id
                                ? {
                                    ...entry,
                                    admin_status: enabling ? 'active' : 'inactive',
                                    effective_access: enabling
                                }
                                : entry
                        ))
                    };
                });
            }
            setNotice(enabling ? 'Instagram account activated.' : 'Instagram account deactivated.');
        } catch (error: any) {
            console.error('Failed to update Instagram account access:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to update Instagram account access.');
        } finally {
            setAccountToggleLoadingId(null);
        }
    };

    const deleteInstagramAccount = async () => {
        if (!selectedUser || !pendingDeleteInstagramAccount?.$id) return;
        if (deleteInstagramConfirmText.trim() !== 'REMOVE') {
            setErrorMessage('Type REMOVE to confirm Instagram account deletion.');
            return;
        }

        setAccountToggleLoadingId(pendingDeleteInstagramAccount.$id);
        setErrorMessage(null);
        try {
            await httpClient.post(`/api/admin/users/${selectedUser.$id}/instagram-accounts/${pendingDeleteInstagramAccount.$id}/delete`);
            await loadUserDetail(selectedUser.$id);
            setUsers((prev) => prev.map((entry) => entry.$id === selectedUser.$id ? {
                ...entry,
                linked_instagram_accounts: Math.max(0, Number(entry.linked_instagram_accounts || 0) - 1)
            } : entry));
            setShowDeleteInstagramDialog(false);
            setDeleteInstagramConfirmText('');
            setPendingDeleteInstagramAccount(null);
            setNotice('Instagram account deleted permanently.');
        } catch (error: any) {
            console.error('Failed to delete Instagram account:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to delete Instagram account.');
        } finally {
            setAccountToggleLoadingId(null);
        }
    };

    const openDashboard = async () => {
        if (!selectedUser) return;
        setOpeningDashboard(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.post('/api/admin/impersonation-token', {
                user_id: selectedUser.$id
            });
            const launchUrl = String(response.data?.launch_url || '').trim();
            if (!launchUrl) {
                throw new Error('Missing launch URL');
            }
            window.open(launchUrl, '_blank', 'noopener,noreferrer');
            setNotice('User dashboard opened in a new tab.');
        } catch (error) {
            console.error('Failed to open user dashboard:', error);
            setErrorMessage('Failed to open user dashboard.');
        } finally {
            setOpeningDashboard(false);
        }
    };

    const deleteUser = async () => {
        if (!selectedUser || isTargetSelfOrAdmin) return;
        if (deleteConfirmText.trim() !== 'DELETE') {
            setErrorMessage('Type DELETE to confirm user deletion.');
            return;
        }

        setIsDeletingUser(true);
        setErrorMessage(null);
        setNotice(null);

        try {
            await httpClient.delete(`/api/admin/users/${selectedUser.$id}`);
            await fetchUsers(Math.max(1, Math.min(pagination.page, pagination.total_pages)));
            setNotice('User deleted permanently.');
            setShowDeleteUserDialog(false);
            setDeleteConfirmText('');
            closeModal();
        } catch (error: any) {
            console.error('Failed to delete user:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to delete user.');
        } finally {
            setIsDeletingUser(false);
        }
    };

    const copyEmailToClipboard = (email: string) => {
        if (!email) return;
        navigator.clipboard?.writeText(email);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
    };

    const hasActiveFilters = Boolean(
        filters.plan ||
        filters.subscription_status ||
        filters.ban_mode ||
        filters.linked_ig_min ||
        filters.linked_ig_max ||
        searchInput
    );

    const resetFilters = () => {
        setFilters({
            plan: '',
            subscription_status: '',
            ban_mode: '',
            linked_ig_min: '',
            linked_ig_max: ''
        });
        setSearchInput('');
    };

    // Quick summary metrics from current dataset
    const metrics = useMemo(() => {
        const total = pagination.total || users.length;
        const paidCount = users.filter((u) => String(u.profile?.plan_code || 'free').toLowerCase() !== 'free').length;
        const totalIg = users.reduce((acc, u) => acc + (u.linked_instagram_accounts || 0), 0);
        const bannedCount = users.filter((u) => u.ban_mode && u.ban_mode !== 'none').length;
        return { total, paidCount, totalIg, bannedCount };
    }, [users, pagination.total]);

    if (!hasLoadedUsersOnce && loading) {
        return <AdminLoadingState title="Loading users" description="Preparing directory and subscriber data." />;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            {/* Header with Search */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">User Directory</h1>
                    <p className="mt-1 text-xs text-muted-foreground">Manage platform accounts, subscriptions, quotas, and security.</p>
                </div>
                <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search name or email..."
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        className="input-base pl-10 pr-8"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                {[
                    { label: 'Total Accounts', value: metrics.total, icon: UsersIcon, tone: 'text-primary' },
                    { label: 'Paid Subscribers', value: metrics.paidCount, icon: Sparkles, tone: 'text-violet-500' },
                    { label: 'Linked IG Accounts', value: metrics.totalIg, icon: Instagram, tone: 'text-pink-500' },
                    { label: 'Moderated', value: metrics.bannedCount, icon: Shield, tone: 'text-amber-500' }
                ].map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="group rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all hover:border-primary/30">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            <div className={cn('rounded-xl bg-muted/60 p-2 transition-colors group-hover:bg-primary/10', tone)}>
                                <Icon className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="mt-2 text-xl font-black tracking-tight text-foreground">{value.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {/* Flash Messages */}
            {!userId && (notice || errorMessage) && (
                <div className={cn(
                    'rounded-2xl border px-4 py-3 text-xs font-semibold shadow-xs animate-in fade-in duration-200',
                    errorMessage
                        ? 'border-destructive/25 bg-destructive/10 text-destructive'
                        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                )}>
                    <div className="flex items-center gap-2">
                        {errorMessage ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        <span>{errorMessage || notice}</span>
                    </div>
                </div>
            )}

            {/* Streamlined Filter Bar */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[140px] flex-1 sm:flex-initial">
                        <SelectField
                            label="Plan"
                            value={filters.plan}
                            onChange={(value) => setFilters((prev) => ({ ...prev, plan: value }))}
                        >
                            <option value="">All Plans</option>
                            <option value="free">Free</option>
                            {pricingPlans
                                .filter((plan) => String(plan.plan_code || plan.id).trim().toLowerCase() !== 'free')
                                .map((plan) => (
                                    <option key={plan.id} value={plan.plan_code || plan.id}>{plan.name}</option>
                                ))}
                        </SelectField>
                    </div>

                    <div className="min-w-[140px] flex-1 sm:flex-initial">
                        <SelectField
                            label="Subscription"
                            value={filters.subscription_status}
                            onChange={(value) => setFilters((prev) => ({ ...prev, subscription_status: value }))}
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="expired">Expired</option>
                        </SelectField>
                    </div>

                    <div className="min-w-[140px] flex-1 sm:flex-initial">
                        <SelectField
                            label="Moderation"
                            value={filters.ban_mode}
                            onChange={(value) => setFilters((prev) => ({ ...prev, ban_mode: value }))}
                        >
                            <option value="">All States</option>
                            <option value="none">Clear</option>
                            <option value="soft">Soft Ban</option>
                            <option value="hard">Hard Ban</option>
                        </SelectField>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-24">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Min IG</label>
                            <input
                                value={filters.linked_ig_min}
                                onChange={(event) => setFilters((prev) => ({ ...prev, linked_ig_min: event.target.value }))}
                                placeholder="0"
                                className="input-base mt-1.5 h-9 text-xs"
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max IG</label>
                            <input
                                value={filters.linked_ig_max}
                                onChange={(event) => setFilters((prev) => ({ ...prev, linked_ig_max: event.target.value }))}
                                placeholder="10"
                                className="input-base mt-1.5 h-9 text-xs"
                            />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="btn-secondary ml-auto mt-auto inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                            title="Reset all filters"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Users Directory Table */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5 bg-muted/20">
                    <span className="text-xs font-bold text-foreground">
                        {pagination.total} Account{pagination.total === 1 ? '' : 's'}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                        Page {pagination.page} of {pagination.total_pages}
                    </span>
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/70 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="px-5 py-3">Subscriber</th>
                                <th className="px-5 py-3">Plan</th>
                                <th className="px-5 py-3">Connected IG</th>
                                <th className="px-5 py-3">Moderation</th>
                                <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-xs text-muted-foreground">
                                        No subscribers match your query or filters.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const planCode = String(user.profile?.plan_code || 'free').toLowerCase();
                                    const isPaid = planCode !== 'free';
                                    const initials = user.name?.charAt(0).toUpperCase() || 'U';
                                    const colorMap = [
                                        'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
                                        'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
                                        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                                        'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
                                        'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/20'
                                    ];
                                    const avatarTheme = colorMap[(user.name || 'User').charCodeAt(0) % colorMap.length];

                                    return (
                                        <tr key={user.$id} className="transition-colors hover:bg-muted/30">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black shadow-xs', avatarTheme)}>
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-foreground truncate">{user.name || 'Anonymous User'}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    'inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
                                                    isPaid
                                                        ? 'border border-primary/25 bg-primary/10 text-primary'
                                                        : 'border border-border/80 bg-muted/40 text-muted-foreground'
                                                )}>
                                                    {planCode}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/50 px-2.5 py-1 text-xs font-semibold text-foreground">
                                                    <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {user.linked_instagram_accounts ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    'status-pill text-[10px] font-bold py-0.5 px-2.5',
                                                    user.ban_mode === 'hard'
                                                        ? 'status-pill-danger'
                                                        : user.ban_mode === 'soft'
                                                            ? 'status-pill-warning'
                                                            : 'status-pill-success'
                                                )}>
                                                    {user.ban_mode === 'hard' ? 'Hard Ban' : user.ban_mode === 'soft' ? 'Soft Ban' : 'Clear'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <Link
                                                    to={`/users/${user.$id}`}
                                                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
                                                >
                                                    <Settings2 className="h-3.5 w-3.5" />
                                                    Manage
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards View */}
                <div className="block md:hidden divide-y divide-border/60">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            No subscribers match your query or filters.
                        </div>
                    ) : (
                        users.map((user) => {
                            const planCode = String(user.profile?.plan_code || 'free').toLowerCase();
                            const isPaid = planCode !== 'free';
                            return (
                                <div key={user.$id} className="p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-foreground text-sm truncate">{user.name || 'Anonymous User'}</p>
                                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                        </div>
                                        <Link to={`/users/${user.$id}`} className="btn-secondary inline-flex h-8 items-center px-3 text-xs font-semibold shrink-0">
                                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                                            Manage
                                        </Link>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                                        <span className={cn(
                                            'font-bold text-[10px] uppercase rounded-md px-2 py-0.5',
                                            isPaid ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {planCode}
                                        </span>
                                        <span className="flex items-center gap-1 text-muted-foreground font-medium text-xs">
                                            <Instagram className="h-3 w-3" />
                                            {user.linked_instagram_accounts ?? 0} linked
                                        </span>
                                        <span className={cn(
                                            'status-pill text-[10px] py-0.5 px-2 font-bold',
                                            user.ban_mode === 'hard'
                                                ? 'status-pill-danger'
                                                : user.ban_mode === 'soft'
                                                    ? 'status-pill-warning'
                                                    : 'status-pill-success'
                                        )}>
                                            {user.ban_mode === 'hard' ? 'Hard Ban' : user.ban_mode === 'soft' ? 'Soft Ban' : 'Clear'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-border/70 px-5 py-3.5 bg-muted/10">
                    <button
                        type="button"
                        onClick={() => void fetchUsers(Math.max(1, pagination.page - 1))}
                        disabled={!pagination.has_previous || loading}
                        className="btn-secondary inline-flex h-8 items-center gap-1 px-3 text-xs font-semibold disabled:opacity-50"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                    </button>
                    <span className="text-xs font-medium text-muted-foreground">
                        Page {pagination.page} / {pagination.total_pages || 1}
                    </span>
                    <button
                        type="button"
                        onClick={() => void fetchUsers(pagination.page + 1)}
                        disabled={!pagination.has_next || loading}
                        className="btn-secondary inline-flex h-8 items-center gap-1 px-3 text-xs font-semibold disabled:opacity-50"
                    >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* User Profile Detail Modal */}
            {userId && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-2 backdrop-blur-md sm:items-center sm:p-4">
                    <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={closeModal} />
                    <div className="relative z-10 w-full max-w-4xl max-h-[92dvh] overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl flex flex-col">
                        {/* Modal Top Bar */}
                        <div className="flex items-center justify-between border-b border-border/70 px-6 py-4 bg-muted/20">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Users
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={openDashboard}
                                    disabled={openingDashboard}
                                    className="btn-primary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-bold shadow-xs disabled:opacity-60"
                                >
                                    {openingDashboard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                                    Access Dashboard
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="custom-scrollbar overflow-y-auto p-6 space-y-6">
                            {detailLoading ? (
                                <AdminLoadingState title="Loading user profile" description="Fetching telemetry, linked assets, and permissions." className="min-h-[260px]" />
                            ) : (
                                <>
                                    {/* User Overview Strip */}
                                    <div className="rounded-2xl border border-border/70 bg-muted/15 p-5">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3.5">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 text-primary text-base font-black shadow-xs">
                                                    {(detailData?.user?.name || selectedUser?.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-lg font-black text-foreground truncate">
                                                        {detailData?.user?.name || selectedUser?.name || 'Anonymous User'}
                                                    </h2>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            {detailData?.user?.email || selectedUser?.email}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyEmailToClipboard(detailData?.user?.email || selectedUser?.email)}
                                                            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition"
                                                            title="Copy email"
                                                        >
                                                            {copiedEmail ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center rounded-lg border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary uppercase">
                                                    {String(detailData?.profile?.plan_code || selectedUser?.profile?.plan_code || 'free')}
                                                </span>
                                                <span className={cn(
                                                    'status-pill text-[10px] font-bold py-1 px-3',
                                                    (detailData?.user?.ban_mode || selectedUser?.ban_mode) === 'hard'
                                                        ? 'status-pill-danger'
                                                        : (detailData?.user?.ban_mode || selectedUser?.ban_mode) === 'soft'
                                                            ? 'status-pill-warning'
                                                            : 'status-pill-success'
                                                )}>
                                                    {(detailData?.user?.ban_mode || selectedUser?.ban_mode) === 'hard' ? 'Hard Ban' : (detailData?.user?.ban_mode || selectedUser?.ban_mode) === 'soft' ? 'Soft Ban' : 'Clear'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Telemetry Summary */}
                                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-border/60">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Linked Accounts</p>
                                                <p className="mt-1 text-lg font-black text-foreground">{detailData?.total_linked_accounts ?? 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transactions</p>
                                                <p className="mt-1 text-lg font-black text-foreground">{detailData?.total_transactions ?? 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan Expiry</p>
                                                <p className="mt-1 text-xs font-bold text-foreground truncate">{formatExpiryLabel(detailData?.profile?.expiry_date)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan Source</p>
                                                <p className="mt-1 text-xs font-bold text-foreground capitalize">{detailData?.profile?.plan_source || 'System'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECTION 1: Linked Instagram Accounts */}
                                    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
                                        <button
                                            type="button"
                                            onClick={() => togglePopupSection('instagram')}
                                            className="flex w-full items-center justify-between text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Instagram className="h-4 w-4 text-pink-500" />
                                                <h3 className="text-sm font-bold text-foreground">Linked Instagram Accounts</h3>
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                                    {(detailData?.instagram_accounts || []).length}
                                                </span>
                                            </div>
                                            {popupSections.instagram ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                        </button>

                                        {popupSections.instagram && (
                                            <div className="mt-4 space-y-3">
                                                {(detailData?.instagram_accounts || []).map((acc: any) => {
                                                    const isAdminActive = String(acc.admin_status || 'active').trim().toLowerCase() === 'active';
                                                    const isUserActive = String(acc.status || 'active').trim().toLowerCase() === 'active';
                                                    const tokenValidity = getInstagramTokenValidity(acc.token_expires_at);

                                                    // Hourly Credit Unlimited Determination (Task 2)
                                                    const hourlyLimitVal = Number(acc.allocated_hourly_credits ?? acc.hourly_action_limit ?? 100);
                                                    const isHourlyUnlimited =
                                                        hourlyLimitVal <= 0 ||
                                                        String(acc.allocated_hourly_credits || acc.hourly_action_limit || '').toLowerCase() === 'unlimited' ||
                                                        String(detailData?.effective_limits?.actions_per_hour_limit || '').toLowerCase() === 'unlimited' ||
                                                        (detailData?.effective_limits?.actions_per_hour_limit !== undefined && Number(detailData.effective_limits.actions_per_hour_limit) <= 0);

                                                    // Daily Credit Unlimited Determination
                                                    const dailyLimitVal = Number(acc.allocated_daily_credits ?? acc.daily_action_limit ?? 1000);
                                                    const isDailyUnlimited =
                                                        dailyLimitVal <= 0 ||
                                                        String(acc.allocated_daily_credits || acc.daily_action_limit || '').toLowerCase() === 'unlimited' ||
                                                        String(detailData?.effective_limits?.actions_per_day_limit || '').toLowerCase() === 'unlimited' ||
                                                        (detailData?.effective_limits?.actions_per_day_limit !== undefined && Number(detailData.effective_limits.actions_per_day_limit) <= 0);

                                                    // Monthly Credit Unlimited Determination
                                                    const monthlyLimitVal = Number(acc.allocated_monthly_credits ?? acc.monthly_action_limit ?? 25000);
                                                    const isMonthlyUnlimited =
                                                        monthlyLimitVal <= 0 ||
                                                        String(acc.allocated_monthly_credits || acc.monthly_action_limit || '').toLowerCase() === 'unlimited' ||
                                                        String(detailData?.effective_limits?.actions_per_month_limit || '').toLowerCase() === 'unlimited' ||
                                                        (detailData?.effective_limits?.actions_per_month_limit !== undefined && Number(detailData.effective_limits.actions_per_month_limit) <= 0);

                                                    return (
                                                        <div key={acc.$id} className="rounded-xl border border-border/70 bg-background/60 p-4 shadow-xs">
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-bold text-foreground text-sm truncate">@{acc.username || acc.ig_user_id || acc.account_id}</p>
                                                                        <span className={cn(
                                                                            'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold',
                                                                            tokenValidity.tone === 'success' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                                                                            tokenValidity.tone === 'warning' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                                                                            tokenValidity.tone === 'danger' && 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                                                                            tokenValidity.tone === 'neutral' && 'bg-muted text-muted-foreground'
                                                                        )}>
                                                                            Token: {tokenValidity.label}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                                        {!isAdminActive ? 'Admin Inactive' : !isUserActive ? 'User Inactive' : 'Active and syncing'}
                                                                    </p>
                                                                </div>

                                                                {/* Account Controls */}
                                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                                    <button
                                                                        type="button"
                                                                        disabled={accountToggleLoadingId === acc.$id}
                                                                        onClick={() => void toggleInstagramAccountAccess(acc)}
                                                                        className={cn(
                                                                            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all',
                                                                            isAdminActive
                                                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                                                                : 'bg-muted text-muted-foreground border border-border hover:text-foreground'
                                                                        )}
                                                                    >
                                                                        {accountToggleLoadingId === acc.$id ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : (
                                                                            <Shield className="h-3 w-3" />
                                                                        )}
                                                                        {isAdminActive ? 'Admin: Active' : 'Admin: Inactive'}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setPendingDeleteInstagramAccount(acc);
                                                                            setDeleteInstagramConfirmText('');
                                                                            setShowDeleteInstagramDialog(true);
                                                                        }}
                                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                                                                        title="Delete Instagram Account"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Quota Strip (Hourly / Daily / Monthly) */}
                                                            <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-xs">
                                                                {/* Hourly Quota */}
                                                                <div className="rounded-lg bg-card p-2 border border-border/60">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hourly</span>
                                                                    <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                        {isHourlyUnlimited ? (
                                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Unlimited</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.max(0, hourlyLimitVal - Number(acc.hourly_actions_used ?? 0)).toLocaleString()}</span>
                                                                                <span className="text-muted-foreground font-normal text-[10px]"> / {hourlyLimitVal.toLocaleString()}</span>
                                                                            </>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground">Used: {Number(acc.hourly_actions_used ?? 0).toLocaleString()}</p>
                                                                </div>

                                                                {/* Daily Quota */}
                                                                <div className="rounded-lg bg-card p-2 border border-border/60">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily</span>
                                                                    <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                        {isDailyUnlimited ? (
                                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Unlimited</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.max(0, dailyLimitVal - Number(acc.daily_actions_used ?? 0)).toLocaleString()}</span>
                                                                                <span className="text-muted-foreground font-normal text-[10px]"> / {dailyLimitVal.toLocaleString()}</span>
                                                                            </>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground">Used: {Number(acc.daily_actions_used ?? 0).toLocaleString()}</p>
                                                                </div>

                                                                {/* Monthly Quota */}
                                                                <div className="rounded-lg bg-card p-2 border border-border/60">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly</span>
                                                                    <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                        {isMonthlyUnlimited ? (
                                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Unlimited</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.max(0, monthlyLimitVal - Number(acc.monthly_actions_used ?? 0)).toLocaleString()}</span>
                                                                                <span className="text-muted-foreground font-normal text-[10px]"> / {monthlyLimitVal.toLocaleString()}</span>
                                                                            </>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground">Used: {Number(acc.monthly_actions_used ?? 0).toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {(!detailData?.instagram_accounts || detailData.instagram_accounts.length === 0) && (
                                                    <p className="py-6 text-center text-xs text-muted-foreground">No linked Instagram accounts found.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 2: Account Moderation */}
                                    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
                                        <button
                                            type="button"
                                            onClick={() => togglePopupSection('ban')}
                                            className="flex w-full items-center justify-between text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Ban className="h-4 w-4 text-amber-500" />
                                                <h3 className="text-sm font-bold text-foreground">Account Moderation</h3>
                                            </div>
                                            {popupSections.ban ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                        </button>

                                        {popupSections.ban && (
                                            <div className="mt-4 space-y-4">
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { mode: 'none', label: 'Clear', desc: 'Full active access' },
                                                        { mode: 'soft', label: 'Soft Ban', desc: 'Read-only dashboard' },
                                                        { mode: 'hard', label: 'Hard Ban', desc: 'Login blocked' }
                                                    ].map(({ mode, label, desc }) => (
                                                        <button
                                                            key={mode}
                                                            type="button"
                                                            onClick={() => setBanMode(mode as any)}
                                                            className={cn(
                                                                'rounded-xl border p-3 text-left transition-all',
                                                                banMode === mode
                                                                    ? 'border-primary bg-primary/10 shadow-xs'
                                                                    : 'border-border/70 bg-background/50 hover:bg-muted/40'
                                                            )}
                                                        >
                                                            <p className={cn('text-xs font-bold', banMode === mode ? 'text-primary' : 'text-foreground')}>{label}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                                                        </button>
                                                    ))}
                                                </div>

                                                <input
                                                    className="input-base text-xs"
                                                    placeholder="Reason for moderation action (optional)"
                                                    value={banReason}
                                                    onChange={(event) => setBanReason(event.target.value)}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() => { setBanConfirmText(''); setShowBanConfirmDialog(true); }}
                                                    disabled={saving || isDeletingUser}
                                                    className="btn-primary inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold disabled:opacity-60"
                                                >
                                                    <Shield className="h-3.5 w-3.5" />
                                                    Apply Moderation Status
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 3: Danger Zone */}
                                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-xs">
                                        <button
                                            type="button"
                                            onClick={() => togglePopupSection('danger')}
                                            className="flex w-full items-center justify-between text-left"
                                        >
                                            <div className="flex items-center gap-2 text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                                <h3 className="text-sm font-bold">Danger Zone</h3>
                                            </div>
                                            {popupSections.danger ? <ChevronUp className="h-4 w-4 text-destructive/70" /> : <ChevronDown className="h-4 w-4 text-destructive/70" />}
                                        </button>

                                        {popupSections.danger && (
                                            <div className="mt-4 pt-3 border-t border-destructive/20 space-y-3">
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Permanently delete this user record, revoke all active sessions, and purge linked automations.
                                                </p>
                                                {isTargetSelfOrAdmin ? (
                                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                        Administrative accounts cannot be deleted here.
                                                    </p>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDeleteConfirmText('');
                                                            setShowDeleteUserDialog(true);
                                                        }}
                                                        disabled={saving || isDeletingUser || isTargetSelfOrAdmin}
                                                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-xs font-bold text-white transition hover:bg-destructive/90 disabled:opacity-50"
                                                    >
                                                        {isDeletingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                        Permanently Delete User
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog: Ban User */}
            <ConfirmDialog
                open={showBanConfirmDialog}
                title="Confirm Moderation Mode"
                description={(
                    <div className="space-y-2.5 text-xs">
                        <p>Apply mode: <strong className="text-foreground uppercase">{banMode}</strong></p>
                        {banReason ? <p>Reason: <span className="text-muted-foreground">{banReason}</span></p> : null}
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground">Type BAN to confirm</label>
                            <input
                                className="input-base mt-1.5 h-9 text-xs"
                                value={banConfirmText}
                                onChange={(event) => setBanConfirmText(event.target.value)}
                                placeholder="BAN"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}
                confirmLabel="Confirm Ban"
                cancelLabel="Cancel"
                tone="danger"
                loading={saving}
                confirmDisabled={banConfirmText.trim() !== 'BAN'}
                onCancel={() => {
                    if (!saving) {
                        setShowBanConfirmDialog(false);
                        setBanConfirmText('');
                    }
                }}
                onConfirm={() => {
                    void saveBan();
                }}
            />

            {/* Confirm Dialog: Delete Instagram Account */}
            <ConfirmDialog
                open={showDeleteInstagramDialog}
                title="Delete Linked Instagram Account?"
                description={(
                    <div className="space-y-2.5 text-xs">
                        <p>
                            {pendingDeleteInstagramAccount
                                ? `Permanently remove @${pendingDeleteInstagramAccount.username || pendingDeleteInstagramAccount.ig_user_id || pendingDeleteInstagramAccount.account_id} and wipe its automation history.`
                                : 'Permanently remove this Instagram account.'}
                        </p>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground">Type REMOVE to confirm</label>
                            <input
                                className="input-base mt-1.5 h-9 text-xs"
                                value={deleteInstagramConfirmText}
                                onChange={(event) => setDeleteInstagramConfirmText(event.target.value)}
                                placeholder="REMOVE"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}
                confirmLabel="Delete Account"
                cancelLabel="Keep Account"
                tone="danger"
                loading={accountToggleLoadingId === pendingDeleteInstagramAccount?.$id}
                confirmDisabled={deleteInstagramConfirmText.trim() !== 'REMOVE'}
                onCancel={() => {
                    if (accountToggleLoadingId !== pendingDeleteInstagramAccount?.$id) {
                        setShowDeleteInstagramDialog(false);
                        setDeleteInstagramConfirmText('');
                        setPendingDeleteInstagramAccount(null);
                    }
                }}
                onConfirm={() => {
                    void deleteInstagramAccount();
                }}
            />

            {/* Confirm Dialog: Delete User */}
            <ConfirmDialog
                open={showDeleteUserDialog}
                title="Permanently Delete User?"
                description={(
                    <div className="space-y-2.5 text-xs">
                        <p>All data and access for {selectedUser?.email || 'this user'} will be irreversibly deleted.</p>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground">Type DELETE to confirm</label>
                            <input
                                className="input-base mt-1.5 h-9 text-xs"
                                value={deleteConfirmText}
                                onChange={(event) => setDeleteConfirmText(event.target.value)}
                                placeholder="DELETE"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}
                confirmLabel="Delete User"
                cancelLabel="Cancel"
                tone="danger"
                loading={isDeletingUser}
                confirmDisabled={deleteConfirmText.trim() !== 'DELETE'}
                onCancel={() => {
                    if (!isDeletingUser) {
                        setShowDeleteUserDialog(false);
                        setDeleteConfirmText('');
                    }
                }}
                onConfirm={() => {
                    void deleteUser();
                }}
            />
        </div>
    );
};

export default UsersPage;
