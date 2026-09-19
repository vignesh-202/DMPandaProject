import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Copy,
    ExternalLink,
    Instagram,
    Loader2,
    RotateCcw,
    Search,
    Shield,
    Sparkles,
    Trash2,
    Users as UsersIcon,
    X,
    Zap
} from 'lucide-react';
import httpClient from '../lib/httpClient';
import { cn } from '../lib/utils';
import AdminLoadingState from '../components/AdminLoadingState';
import ConfirmDialog from '../components/ConfirmDialog';
import { loadCachedResource } from '../lib/resourceCache';
import { useAuth } from '../context/AuthContext';

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
    actions_per_hour_limit?: number | string;
    actions_per_day_limit?: number | string;
    actions_per_month_limit?: number | string;
    entitlements?: Record<string, boolean>;
    benefits?: Array<{ key: string; enabled: boolean }>;
}

const formatExpiryLabel = (value?: string | null) => {
    if (!value) return 'No expiry date';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'No expiry date' : parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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

type ModalTab = 'plan' | 'instagram' | 'moderation' | 'danger';

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

    // Plan assignment state for the user popup
    const [selectedPlanCode, setSelectedPlanCode] = useState<string>('free');
    const [durationMode, setDurationMode] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
    const [customExpiryDate, setCustomExpiryDate] = useState<string>('');
    const [savingPlan, setSavingPlan] = useState(false);

    // Moderation state
    const [banMode, setBanMode] = useState<'none' | 'soft' | 'hard'>('none');
    const [banReason, setBanReason] = useState('');
    const [savingBan, setSavingBan] = useState(false);

    // Modal UI states
    const [activeTab, setActiveTab] = useState<ModalTab>('plan');
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
        }, 250);
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
            const data = response.data;
            setDetailData(data);
            setBanMode(String(data?.user?.ban_mode || 'none') as 'none' | 'soft' | 'hard');
            setBanReason(data?.user?.ban_reason || '');

            // Initialize plan state
            const currentPlan = String(data?.profile?.plan_code || data?.effective_plan?.plan_code || 'free').trim().toLowerCase();
            setSelectedPlanCode(currentPlan);
            setDurationMode('monthly');
            if (data?.profile?.expiry_date) {
                const d = new Date(data.profile.expiry_date);
                if (!Number.isNaN(d.getTime())) {
                    setCustomExpiryDate(d.toISOString().slice(0, 16));
                }
            }
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
            setActiveTab('plan');
            return;
        }
        setActiveTab('plan');
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

    // Update Plan of the User
    const handleUpdateUserPlan = async () => {
        if (!selectedUser) return;
        setSavingPlan(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.patch(`/api/admin/users/${selectedUser.$id}/profile`, {
                action: 'change_assigned_plan',
                plan_code: selectedPlanCode,
                duration_mode: durationMode,
                custom_expiry_date: durationMode === 'custom' && customExpiryDate ? new Date(customExpiryDate).toISOString() : null
            });

            const result = response.data?.data || response.data || {};
            mergeDetailData(result);

            // Update user row in table state
            setUsers((prev) => prev.map((entry) => {
                if (entry.$id === selectedUser.$id) {
                    return {
                        ...entry,
                        profile: {
                            ...(entry.profile || {}),
                            plan_code: selectedPlanCode,
                            expiry_date: result?.profile?.expiry_date || result?.expiry_date || entry.profile?.expiry_date
                        }
                    };
                }
                return entry;
            }));

            setNotice(`User plan updated to ${selectedPlanCode.toUpperCase()}.`);
        } catch (error: any) {
            console.error('Failed to update user plan:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to update user plan.');
        } finally {
            setSavingPlan(false);
        }
    };

    // Moderation
    const saveBan = async () => {
        if (!selectedUser) return;
        setSavingBan(true);
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
            setNotice('Moderation status updated successfully.');
        } catch (error: any) {
            console.error('Failed to update ban status:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to update ban status.');
        } finally {
            setSavingBan(false);
        }
    };

    // Toggle Instagram Account Active / Inactive
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
            setNotice(enabling ? `@${account.username || 'Account'} is now Active.` : `@${account.username || 'Account'} is now Inactive.`);
        } catch (error: any) {
            console.error('Failed to update Instagram account access:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to update Instagram account access.');
        } finally {
            setAccountToggleLoadingId(null);
        }
    };

    // Delete Instagram Account
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
            setNotice('Instagram account permanently deleted.');
        } catch (error: any) {
            console.error('Failed to delete Instagram account:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to delete Instagram account.');
        } finally {
            setAccountToggleLoadingId(null);
        }
    };

    // Access user dashboard impersonation
    const openDashboard = async () => {
        if (!selectedUser) return;
        setOpeningDashboard(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.post('/api/admin/impersonation-token', {
                user_id: selectedUser.$id
            });
            const launchUrl = String(response.data?.launch_url || '').trim();
            if (!launchUrl) throw new Error('Missing launch URL');
            window.open(launchUrl, '_blank', 'noopener,noreferrer');
            setNotice('User dashboard opened in a new tab.');
        } catch (error) {
            console.error('Failed to open user dashboard:', error);
            setErrorMessage('Failed to open user dashboard.');
        } finally {
            setOpeningDashboard(false);
        }
    };

    // Delete User
    const deleteUser = async () => {
        if (!selectedUser || isTargetSelfOrAdmin) return;
        if (deleteConfirmText.trim() !== 'DELETE') {
            setErrorMessage('Type DELETE to confirm user deletion.');
            return;
        }

        setIsDeletingUser(true);
        setErrorMessage(null);
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

    // Compute preview limits for the selected plan
    const selectedPlanPreview = useMemo(() => {
        const found = pricingPlans.find(
            (p) => String(p.plan_code || p.id).trim().toLowerCase() === selectedPlanCode.toLowerCase()
        );
        if (found) return found;
        if (selectedPlanCode === 'free') {
            return {
                id: 'free',
                name: 'Free Plan',
                plan_code: 'free',
                actions_per_hour_limit: 100,
                actions_per_day_limit: 1000,
                actions_per_month_limit: 25000,
                instagram_connections_limit: 1
            };
        }
        return detailData?.effective_plan || null;
    }, [pricingPlans, selectedPlanCode, detailData?.effective_plan]);

    const isHourlyUnlimited = useMemo(() => {
        const val = selectedPlanPreview?.actions_per_hour_limit ?? detailData?.effective_limits?.actions_per_hour_limit ?? 100;
        return Number(val) <= 0 || String(val).toLowerCase() === 'unlimited';
    }, [selectedPlanPreview, detailData?.effective_limits]);

    const isDailyUnlimited = useMemo(() => {
        const val = selectedPlanPreview?.actions_per_day_limit ?? detailData?.effective_limits?.actions_per_day_limit ?? 1000;
        return Number(val) <= 0 || String(val).toLowerCase() === 'unlimited';
    }, [selectedPlanPreview, detailData?.effective_limits]);

    const isMonthlyUnlimited = useMemo(() => {
        const val = selectedPlanPreview?.actions_per_month_limit ?? detailData?.effective_limits?.actions_per_month_limit ?? 25000;
        return Number(val) <= 0 || String(val).toLowerCase() === 'unlimited';
    }, [selectedPlanPreview, detailData?.effective_limits]);

    const allowedAccountsCount = selectedPlanPreview?.instagram_connections_limit ?? detailData?.effective_limits?.active_account_limit ?? 1;

    // Metrics
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
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Users</h1>
                    <p className="mt-1 text-xs text-muted-foreground">Manage user subscriptions, linked Instagram accounts, and security.</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        className="input-base h-9 pl-9 pr-8 text-xs"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Total Users', value: metrics.total, icon: UsersIcon, tone: 'text-primary bg-primary/10' },
                    { label: 'Paid Subscribers', value: metrics.paidCount, icon: Sparkles, tone: 'text-violet-500 bg-violet-500/10' },
                    { label: 'Linked Accounts', value: metrics.totalIg, icon: Instagram, tone: 'text-pink-500 bg-pink-500/10' },
                    { label: 'Moderated', value: metrics.bannedCount, icon: Shield, tone: 'text-amber-500 bg-amber-500/10' }
                ].map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="group rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/30">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">{label}</span>
                            <div className={cn('rounded-xl p-2 transition-colors', tone)}>
                                <Icon className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="mt-2 text-xl font-bold tracking-tight text-foreground font-mono">{value.toLocaleString()}</p>
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

            {/* Modern Streamlined Filter Bar */}
            <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs">
                {/* Plan filter */}
                <div className="flex items-center gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
                    <select
                        value={filters.plan}
                        onChange={(e) => setFilters((prev) => ({ ...prev, plan: e.target.value }))}
                        className="input-base h-9 text-xs font-medium bg-background cursor-pointer"
                    >
                        <option value="">All Plans</option>
                        <option value="free">Free Plan</option>
                        {pricingPlans
                            .filter((plan) => String(plan.plan_code || plan.id).trim().toLowerCase() !== 'free')
                            .map((plan) => (
                                <option key={plan.id} value={plan.plan_code || plan.id}>{plan.name}</option>
                            ))}
                    </select>
                </div>

                {/* Subscription status filter */}
                <div className="flex items-center gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
                    <select
                        value={filters.subscription_status}
                        onChange={(e) => setFilters((prev) => ({ ...prev, subscription_status: e.target.value }))}
                        className="input-base h-9 text-xs font-medium bg-background cursor-pointer"
                    >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>

                {/* Moderation state filter */}
                <div className="flex items-center gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
                    <select
                        value={filters.ban_mode}
                        onChange={(e) => setFilters((prev) => ({ ...prev, ban_mode: e.target.value }))}
                        className="input-base h-9 text-xs font-medium bg-background cursor-pointer"
                    >
                        <option value="">All Moderation</option>
                        <option value="none">Clear</option>
                        <option value="soft">Soft Ban</option>
                        <option value="hard">Hard Ban</option>
                    </select>
                </div>

                {/* Linked IG count range */}
                <div className="flex items-center gap-1.5">
                    <input
                        value={filters.linked_ig_min}
                        onChange={(event) => setFilters((prev) => ({ ...prev, linked_ig_min: event.target.value }))}
                        placeholder="Min IG"
                        type="number"
                        min="0"
                        className="input-base h-9 w-20 text-xs text-center"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                        value={filters.linked_ig_max}
                        onChange={(event) => setFilters((prev) => ({ ...prev, linked_ig_max: event.target.value }))}
                        placeholder="Max IG"
                        type="number"
                        min="0"
                        className="input-base h-9 w-20 text-xs text-center"
                    />
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="btn-secondary ml-auto inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                        title="Reset all filters"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </button>
                )}
            </div>

            {/* Users Directory Table Container (Generous padding so left edge never clips) */}
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
                <div className="flex items-center justify-between border-b border-border/70 px-6 py-3.5 bg-muted/20">
                    <span className="text-xs font-bold text-foreground">
                        {pagination.total} Account{pagination.total === 1 ? '' : 's'}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                        Page {pagination.page} of {pagination.total_pages || 1}
                    </span>
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/70 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="px-6 py-3">Subscriber</th>
                                <th className="px-6 py-3">Plan</th>
                                <th className="px-6 py-3">Connected IG</th>
                                <th className="px-6 py-3">Moderation</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
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

                                    return (
                                        <tr key={user.$id} className="transition-colors hover:bg-muted/30">
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold shadow-xs">
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-foreground truncate text-xs">{user.name || 'Anonymous User'}</p>
                                                        <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={cn(
                                                    'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                                    isPaid
                                                        ? 'border border-primary/30 bg-primary/10 text-primary'
                                                        : 'border border-border/80 bg-muted/40 text-muted-foreground'
                                                )}>
                                                    {planCode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                                                    <Instagram className="h-3.5 w-3.5 text-pink-500" />
                                                    {user.linked_instagram_accounts ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={cn(
                                                    'status-pill text-[10px] font-bold py-0.5 px-2',
                                                    user.ban_mode === 'hard'
                                                        ? 'status-pill-danger'
                                                        : user.ban_mode === 'soft'
                                                            ? 'status-pill-warning'
                                                            : 'status-pill-success'
                                                )}>
                                                    {user.ban_mode === 'hard' ? 'Hard Ban' : user.ban_mode === 'soft' ? 'Soft Ban' : 'Clear'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-right">
                                                <Link
                                                    to={`/users/${user.$id}`}
                                                    className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium hover:border-primary/40"
                                                >
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
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
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
                                            <p className="text-xs text-muted-foreground truncate font-mono">{user.email}</p>
                                        </div>
                                        <Link to={`/users/${user.$id}`} className="btn-secondary inline-flex h-8 items-center px-3 text-xs font-semibold shrink-0">
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
                                            <Instagram className="h-3 w-3 text-pink-500" />
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
                <div className="flex items-center justify-between border-t border-border/70 px-6 py-3.5 bg-muted/10">
                    <button
                        type="button"
                        onClick={() => void fetchUsers(Math.max(1, pagination.page - 1))}
                        disabled={!pagination.has_previous || loading}
                        className="btn-secondary inline-flex h-8 items-center gap-1 px-3 text-xs font-medium disabled:opacity-50"
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
                        className="btn-secondary inline-flex h-8 items-center gap-1 px-3 text-xs font-medium disabled:opacity-50"
                    >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* User Profile Detail Popup / Modal */}
            {userId && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-2 backdrop-blur-md sm:items-center sm:p-4">
                    <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={closeModal} />
                    <div className="relative z-10 w-full max-w-3xl max-h-[92dvh] overflow-hidden rounded-[24px] border border-border/80 bg-card shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Top Bar */}
                        <div className="flex items-center justify-between border-b border-border/70 px-6 py-3.5 bg-muted/20">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Back to Users
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={openDashboard}
                                    disabled={openingDashboard}
                                    className="btn-primary inline-flex h-8 items-center gap-1.5 px-3 text-xs font-semibold shadow-xs disabled:opacity-60"
                                >
                                    {openingDashboard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                                    Dashboard
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="custom-scrollbar overflow-y-auto p-6 space-y-5">
                            {detailLoading ? (
                                <AdminLoadingState title="Loading user profile" description="Fetching telemetry, plan details, and permissions." className="min-h-[260px]" />
                            ) : (
                                <>
                                    {/* User Overview Header Strip */}
                                    <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary text-base font-bold shadow-xs">
                                                    {(detailData?.user?.name || selectedUser?.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-base font-bold text-foreground truncate">
                                                        {detailData?.user?.name || selectedUser?.name || 'Anonymous User'}
                                                    </h2>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-muted-foreground truncate font-mono">
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
                                                <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary uppercase tracking-wide">
                                                    {String(detailData?.profile?.plan_code || selectedUser?.profile?.plan_code || 'free')}
                                                </span>
                                                <span className={cn(
                                                    'status-pill text-[10px] font-bold py-1 px-2.5',
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
                                    </div>

                                    {/* Navigation Tabs for Popup */}
                                    <div className="flex items-center gap-1 border-b border-border/60 pb-1">
                                        {[
                                            { id: 'plan', label: 'User Plan & Quotas', icon: Sparkles },
                                            { id: 'instagram', label: `IG Accounts (${(detailData?.instagram_accounts || []).length})`, icon: Instagram },
                                            { id: 'moderation', label: 'Moderation', icon: Shield },
                                            { id: 'danger', label: 'Danger Zone', icon: Trash2 }
                                        ].map(({ id, label, icon: Icon }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setActiveTab(id as ModalTab)}
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all',
                                                    activeTab === id
                                                        ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                                <span>{label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Flash Message inside Modal */}
                                    {(notice || errorMessage) && (
                                        <div className={cn(
                                            'rounded-xl border px-3.5 py-2.5 text-xs font-semibold animate-in fade-in duration-150',
                                            errorMessage
                                                ? 'border-destructive/25 bg-destructive/10 text-destructive'
                                                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        )}>
                                            <div className="flex items-center gap-2">
                                                {errorMessage ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                                <span>{errorMessage || notice}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 1: USER PLAN & QUOTAS */}
                                    {activeTab === 'plan' && (
                                        <div className="space-y-4">
                                            {/* Current Plan Overview Card */}
                                            <div className="rounded-2xl border border-border/80 bg-background/60 p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Active Plan</span>
                                                        <h3 className="text-base font-black text-foreground capitalize mt-0.5">
                                                            {detailData?.profile?.plan_code || 'free'} Plan
                                                        </h3>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expiry Date</span>
                                                        <p className="text-xs font-bold text-foreground mt-0.5">
                                                            {formatExpiryLabel(detailData?.profile?.expiry_date)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50 text-xs">
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Plan Source</span>
                                                        <p className="font-semibold text-foreground capitalize">{detailData?.profile?.plan_source || 'System'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Status</span>
                                                        <p className={cn(
                                                            "font-semibold capitalize",
                                                            detailData?.subscription_summary?.derived_status === 'active'
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-muted-foreground"
                                                        )}>
                                                            {detailData?.subscription_summary?.derived_status || 'Active'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Linked IG Limit</span>
                                                        <p className="font-semibold text-foreground">{allowedAccountsCount} Account(s)</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground">Total Transactions</span>
                                                        <p className="font-semibold text-foreground">{detailData?.total_transactions ?? 0}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Assign / Change User Plan Form */}
                                            <div className="rounded-2xl border border-border/80 bg-background/60 p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-foreground">Change User Plan</h4>
                                                    <span className="text-[10px] text-muted-foreground">Admin overrides take effect immediately</span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Select Plan</label>
                                                        <select
                                                            value={selectedPlanCode}
                                                            onChange={(e) => setSelectedPlanCode(e.target.value)}
                                                            className="input-base h-9 text-xs font-medium cursor-pointer"
                                                        >
                                                            <option value="free">Free Plan</option>
                                                            {pricingPlans
                                                                .filter((p) => String(p.plan_code || p.id).trim().toLowerCase() !== 'free')
                                                                .map((p) => (
                                                                    <option key={p.id} value={p.plan_code || p.id}>{p.name}</option>
                                                                ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Duration</label>
                                                        <select
                                                            value={durationMode}
                                                            onChange={(e) => setDurationMode(e.target.value as any)}
                                                            className="input-base h-9 text-xs font-medium cursor-pointer"
                                                            disabled={selectedPlanCode === 'free'}
                                                        >
                                                            <option value="monthly">Monthly (30 Days)</option>
                                                            <option value="yearly">Yearly (365 Days)</option>
                                                            <option value="custom">Custom Date</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {durationMode === 'custom' && selectedPlanCode !== 'free' && (
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Custom Expiration Date</label>
                                                        <input
                                                            type="datetime-local"
                                                            value={customExpiryDate}
                                                            onChange={(e) => setCustomExpiryDate(e.target.value)}
                                                            className="input-base h-9 text-xs"
                                                        />
                                                    </div>
                                                )}

                                                {/* Live Quota Preview for the Plan */}
                                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                                        Plan Limits & Action Quotas
                                                    </p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                        {/* Hourly Quota (Shows Unlimited if unlimited) */}
                                                        <div className="rounded-lg bg-card p-2 border border-border/50">
                                                            <span className="text-[10px] text-muted-foreground block">Hourly Limit</span>
                                                            <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                {isHourlyUnlimited ? (
                                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                        <Zap className="h-3 w-3" />
                                                                        Unlimited
                                                                    </span>
                                                                ) : (
                                                                    `${Number(selectedPlanPreview?.actions_per_hour_limit ?? 100).toLocaleString()} / hr`
                                                                )}
                                                            </p>
                                                        </div>

                                                        {/* Daily Quota */}
                                                        <div className="rounded-lg bg-card p-2 border border-border/50">
                                                            <span className="text-[10px] text-muted-foreground block">Daily Limit</span>
                                                            <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                {isDailyUnlimited ? (
                                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                        <Zap className="h-3 w-3" />
                                                                        Unlimited
                                                                    </span>
                                                                ) : (
                                                                    `${Number(selectedPlanPreview?.actions_per_day_limit ?? 1000).toLocaleString()} / day`
                                                                )}
                                                            </p>
                                                        </div>

                                                        {/* Monthly Quota */}
                                                        <div className="rounded-lg bg-card p-2 border border-border/50">
                                                            <span className="text-[10px] text-muted-foreground block">Monthly Limit</span>
                                                            <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                {isMonthlyUnlimited ? (
                                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                        <Zap className="h-3 w-3" />
                                                                        Unlimited
                                                                    </span>
                                                                ) : (
                                                                    `${Number(selectedPlanPreview?.actions_per_month_limit ?? 25000).toLocaleString()} / mo`
                                                                )}
                                                            </p>
                                                        </div>

                                                        {/* Max Connected Accounts */}
                                                        <div className="rounded-lg bg-card p-2 border border-border/50">
                                                            <span className="text-[10px] text-muted-foreground block">Max IG Links</span>
                                                            <p className="mt-0.5 text-xs font-bold text-foreground">
                                                                {allowedAccountsCount} Account{allowedAccountsCount === 1 ? '' : 's'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={handleUpdateUserPlan}
                                                    disabled={savingPlan}
                                                    className="btn-primary inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold shadow-xs disabled:opacity-60"
                                                >
                                                    {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                                    Update User Plan
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: LINKED INSTAGRAM ACCOUNTS */}
                                    {activeTab === 'instagram' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground">
                                                    Toggle account access on or off, check token health, or unlink an account.
                                                </p>
                                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                                                    {(detailData?.instagram_accounts || []).length} linked
                                                </span>
                                            </div>

                                            {(!detailData?.instagram_accounts || detailData.instagram_accounts.length === 0) ? (
                                                <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                                                    No Instagram accounts linked to this user yet.
                                                </div>
                                            ) : (
                                                detailData.instagram_accounts.map((acc: any) => {
                                                    const isAdminActive = String(acc.admin_status || 'active').trim().toLowerCase() === 'active';
                                                    const isUserActive = String(acc.status || 'active').trim().toLowerCase() === 'active';
                                                    const tokenValidity = getInstagramTokenValidity(acc.token_expires_at);

                                                    return (
                                                        <div
                                                            key={acc.$id}
                                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/60 p-4 shadow-xs"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10 text-pink-500">
                                                                    <Instagram className="h-5 w-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-bold text-foreground text-sm truncate">
                                                                            @{acc.username || acc.ig_user_id || acc.account_id}
                                                                        </p>
                                                                        <span className={cn(
                                                                            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                                                                            tokenValidity.tone === 'success' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                                                                            tokenValidity.tone === 'warning' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                                                                            tokenValidity.tone === 'danger' && 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                                                                            tokenValidity.tone === 'neutral' && 'bg-muted text-muted-foreground'
                                                                        )}>
                                                                            Token: {tokenValidity.label}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {!isAdminActive ? 'Admin Inactive' : !isUserActive ? 'User Inactive' : 'Active and syncing'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Controls: Authentic Toggle Switch + Delete Button */}
                                                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                                                {/* Interactive Toggle Switch */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className={cn(
                                                                        "text-xs font-semibold select-none",
                                                                        isAdminActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                                                    )}>
                                                                        {isAdminActive ? "Active" : "Inactive"}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        role="switch"
                                                                        aria-checked={isAdminActive}
                                                                        disabled={accountToggleLoadingId === acc.$id}
                                                                        onClick={() => void toggleInstagramAccountAccess(acc)}
                                                                        className={cn(
                                                                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
                                                                            isAdminActive ? "bg-emerald-500" : "bg-muted-foreground/30"
                                                                        )}
                                                                        title={isAdminActive ? "Click to deactivate Instagram account" : "Click to activate Instagram account"}
                                                                    >
                                                                        <span
                                                                            className={cn(
                                                                                "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                                                                                isAdminActive ? "translate-x-5" : "translate-x-0"
                                                                            )}
                                                                        >
                                                                            {accountToggleLoadingId === acc.$id ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin text-zinc-600" />
                                                                            ) : null}
                                                                        </span>
                                                                    </button>
                                                                </div>

                                                                {/* Delete Account */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPendingDeleteInstagramAccount(acc);
                                                                        setDeleteInstagramConfirmText('');
                                                                        setShowDeleteInstagramDialog(true);
                                                                    }}
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                                                                    title="Delete Instagram Account"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 3: ACCOUNT MODERATION */}
                                    {activeTab === 'moderation' && (
                                        <div className="space-y-4">
                                            <p className="text-xs text-muted-foreground">
                                                Enforce security constraints or suspend user access for compliance review.
                                            </p>

                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { mode: 'none', label: 'Clear', desc: 'Full active platform access' },
                                                    { mode: 'soft', label: 'Soft Ban', desc: 'Read-only dashboard access' },
                                                    { mode: 'hard', label: 'Hard Ban', desc: 'Complete login block' }
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
                                                disabled={savingBan || isDeletingUser}
                                                className="btn-primary inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold disabled:opacity-60"
                                            >
                                                <Shield className="h-3.5 w-3.5" />
                                                Apply Moderation Status
                                            </button>
                                        </div>
                                    )}

                                    {/* TAB 4: DANGER ZONE */}
                                    {activeTab === 'danger' && (
                                        <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                                            <div className="flex items-center gap-2 text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                                <h4 className="text-sm font-bold">Permanently Delete User</h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Irreversibly delete this user record, revoke all active sessions, and purge all linked automations and data.
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
                                                    disabled={savingBan || isDeletingUser || isTargetSelfOrAdmin}
                                                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-xs font-bold text-white transition hover:bg-destructive/90 disabled:opacity-50"
                                                >
                                                    {isDeletingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                    Permanently Delete User
                                                </button>
                                            )}
                                        </div>
                                    )}
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
                loading={savingBan}
                confirmDisabled={banConfirmText.trim() !== 'BAN'}
                onCancel={() => {
                    if (!savingBan) {
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
