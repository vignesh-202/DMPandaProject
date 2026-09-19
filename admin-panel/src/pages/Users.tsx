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
    Loader2,
    Search,
    Settings2,
    Shield,
    Trash2,
    X
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
            label: 'Unknown validity',
            detail: 'Token expiry is not available.'
        };
    }

    const expiresAt = new Date(value);
    const expiresMs = expiresAt.getTime();
    if (Number.isNaN(expiresMs)) {
        return {
            tone: 'neutral' as const,
            label: 'Unknown validity',
            detail: 'Token expiry could not be parsed.'
        };
    }

    const diffMs = expiresMs - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs <= 0) {
        return {
            tone: 'danger' as const,
            label: 'Expired',
            detail: `Expired on ${formatExpiryLabel(value)}`
        };
    }

    if (diffDays <= 7) {
        return {
            tone: 'warning' as const,
            label: 'Expiring soon',
            detail: `${diffDays} day${diffDays === 1 ? '' : 's'} left`
        };
    }

    return {
        tone: 'success' as const,
        label: 'Valid',
        detail: `${diffDays} days left`
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

const surfaceClass = 'rounded-2xl border border-border bg-card shadow-xs';
const popupSectionClass = 'rounded-2xl border border-border bg-card p-5 shadow-sm';
const popupInsetClass = 'rounded-xl border border-border bg-background/70 px-4 py-4 shadow-xs';
const popupHeaderBandClass = 'rounded-xl border border-border bg-muted/20 p-5 shadow-xs';
const DEFAULT_POPUP_SECTION_STATE: Record<PopupSectionKey, boolean> = {
    instagram: true,
    ban: false,
    danger: false
};

// SelectField imported from shared UI component
import { SelectField } from '../components/ui/SelectField';

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
        if (!selectedUser) return;
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

    if (!hasLoadedUsersOnce && loading) {
        return <AdminLoadingState title="Loading users" description="Preparing user records, subscription details, and moderation controls." />;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <p className="text-xs font-semibold text-primary">Users</p>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">User Management</h1>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                        Search, filter, and manage individual users with audited plan controls and direct dashboard access.
                    </p>
                </div>
                <div className="relative w-full xl:w-96">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search users by name or email"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        className="input-base pl-11"
                    />
                </div>
            </div>

            {!userId && (notice || errorMessage) && (
                <div className={cn(
                    'rounded-xl border px-4 py-3 text-sm font-medium shadow-xs',
                    errorMessage
                        ? 'border-destructive/20 bg-destructive/5 text-destructive'
                        : 'border-success/20 bg-success/5 text-success'
                )}>
                    {errorMessage || notice}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SelectField
                    label="Plan"
                    hint="Filter users by their assigned plan."
                    value={filters.plan}
                    onChange={(value) => setFilters((prev) => ({ ...prev, plan: value }))}
                >
                    <option value="">All plans</option>
                    <option value="free">Free Plan</option>
                    {pricingPlans
                        .filter((plan) => String(plan.plan_code || plan.id).trim().toLowerCase() !== 'free')
                        .map((plan) => (
                            <option key={plan.id} value={plan.plan_code || plan.id}>{plan.name}</option>
                        ))}
                </SelectField>
                <SelectField
                    label="Subscription"
                    hint="Focus on active, inactive, or expired subscriptions."
                    value={filters.subscription_status}
                    onChange={(value) => setFilters((prev) => ({ ...prev, subscription_status: value }))}
                >
                    <option value="">Any status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                </SelectField>
                <SelectField
                    label="Ban mode"
                    hint="Review users by moderation state."
                    value={filters.ban_mode}
                    onChange={(value) => setFilters((prev) => ({ ...prev, ban_mode: value }))}
                >
                    <option value="">Any moderation state</option>
                    <option value="none">Clear</option>
                    <option value="soft">Soft ban</option>
                    <option value="hard">Hard ban</option>
                </SelectField>
                <div className={`${surfaceClass} p-4`}>
                    <label className="text-xs font-semibold text-muted-foreground">Min IG Accounts</label>
                    <input
                        value={filters.linked_ig_min}
                        onChange={(event) => setFilters((prev) => ({ ...prev, linked_ig_min: event.target.value }))}
                        placeholder="0"
                        className="input-base mt-2"
                    />
                </div>
                <div className={`${surfaceClass} p-4`}>
                    <label className="text-xs font-semibold text-muted-foreground">Max IG Accounts</label>
                    <input
                        value={filters.linked_ig_max}
                        onChange={(event) => setFilters((prev) => ({ ...prev, linked_ig_max: event.target.value }))}
                        placeholder="10"
                        className="input-base mt-2"
                    />
                </div>
            </div>

            <section className={surfaceClass}>
                <div className="flex flex-col gap-4 border-b border-border/70 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">All Users</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Paginated results with debounced search and server-side filtering.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-foreground">
                        {pagination.total} matching users
                    </div>
                </div>

                {/* Desktop & Tablet Table View */}
                <div className="hidden md:block overflow-x-auto overscroll-x-contain">
                    <table className="min-w-full w-full text-left">
                        <thead>
                            <tr className="border-b border-border/70 bg-background/40">
                                <th className="px-6 py-3.5 text-xs font-semibold text-muted-foreground">User</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-muted-foreground">Plan</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-muted-foreground">IG Accounts</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-muted-foreground">Ban</th>
                                <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-muted-foreground">
                                        No users match the current search or filters.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.$id} className="transition-colors hover:bg-background/40">
                                        <td className="min-w-[220px] px-4 py-5 sm:px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-black text-foreground">
                                                    {user.name?.charAt(0) || 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-foreground">{user.name}</p>
                                                    <p className="break-all text-[11px] text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-xs font-bold text-foreground sm:px-6">
                                            {user.profile?.plan_code || 'free'}
                                        </td>
                                        <td className="px-4 py-5 text-xs font-bold text-foreground sm:px-6">
                                            {user.linked_instagram_accounts ?? 0}
                                        </td>
                                        <td className="px-4 py-5 sm:px-6">
                                            <span className={cn(
                                                'status-pill',
                                                user.ban_mode === 'hard'
                                                    ? 'status-pill-danger'
                                                    : user.ban_mode === 'soft'
                                                        ? 'status-pill-warning'
                                                        : 'status-pill-success'
                                            )}>
                                                {user.ban_mode || 'none'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 text-right sm:px-6">
                                            <Link to={`/users/${user.$id}`} className="btn-secondary inline-flex min-h-10 items-center justify-center px-3 py-2 text-[10px] sm:px-4">
                                                <Settings2 className="h-4 w-4" />
                                                Manage
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Responsive Cards View */}
                <div className="block md:hidden divide-y divide-border/60">
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No users match the current search or filters.
                        </div>
                    ) : (
                        users.map((user) => (
                            <div key={user.$id} className="p-4 space-y-3 transition-colors hover:bg-background/40">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-black text-foreground">
                                        {user.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                                        <p className="break-all text-[11px] text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                    <Link to={`/users/${user.$id}`} className="btn-secondary inline-flex h-9 items-center justify-center px-3 text-xs shrink-0">
                                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                                        Manage
                                    </Link>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-[11px]">Plan:</span>
                                        <span className="font-bold text-foreground capitalize">{user.profile?.plan_code || 'free'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-[11px]">IG:</span>
                                        <span className="font-bold text-foreground">{user.linked_instagram_accounts ?? 0} linked</span>
                                    </div>
                                    <div>
                                        <span className={cn(
                                            'status-pill text-[10px] py-0.5 px-2',
                                            user.ban_mode === 'hard'
                                                ? 'status-pill-danger'
                                                : user.ban_mode === 'soft'
                                                    ? 'status-pill-warning'
                                                    : 'status-pill-success'
                                        )}>
                                            {user.ban_mode || 'none'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex flex-col gap-4 border-t border-border/70 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-xs text-muted-foreground">
                        Page {pagination.page} of {pagination.total_pages}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => void fetchUsers(Math.max(1, pagination.page - 1))}
                            disabled={!pagination.has_previous || loading}
                            className="btn-secondary inline-flex min-h-10 items-center justify-center px-4 py-2 text-[10px] disabled:opacity-60"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() => void fetchUsers(pagination.page + 1)}
                            disabled={!pagination.has_next || loading}
                            className="btn-secondary inline-flex min-h-10 items-center justify-center px-4 py-2 text-[10px] disabled:opacity-60"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>

            {userId && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-2 backdrop-blur-sm sm:items-center sm:p-4">
                    <button type="button" className="absolute inset-0" aria-label="Close user manager" onClick={closeModal} />
                    <div className="relative z-10 w-full max-w-6xl">
                        {(notice || errorMessage) && (
                            <div
                                className={cn(
                                    'pointer-events-none absolute right-3 top-3 z-30 max-w-[calc(100%-1.5rem)] rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-2 sm:right-4 sm:top-4 sm:max-w-md sm:text-sm',
                                    errorMessage
                                        ? 'border-destructive/25 bg-destructive text-destructive-foreground'
                                        : 'border-success/25 bg-success text-success-foreground'
                                )}
                            >
                                {errorMessage || notice}
                            </div>
                        )}
                        <section className={`${surfaceClass} custom-scrollbar relative max-h-[calc(100dvh-0.5rem)] overflow-y-auto rounded-t-[1.75rem] p-3 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:p-6`}>
                        {detailLoading ? (
                            <AdminLoadingState title="Loading user details" description="Fetching profile overrides, account links, and moderation state." className="min-h-[320px]" />
                        ) : (
                            <div className="space-y-6">
                                <div className={popupHeaderBandClass}>
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <button
                                                type="button"
                                                onClick={closeModal}
                                                className="inline-flex items-center gap-2 text-xs font-black text-muted-foreground transition hover:text-foreground"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                                Back to users
                                            </button>
                                            <h2 className="mt-3 text-2xl font-extrabold text-foreground">{detailData?.user?.name || selectedUser?.name}</h2>
                                            <p className="break-all text-sm text-muted-foreground">{detailData?.user?.email || selectedUser?.email}</p>
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <button
                                                type="button"
                                                onClick={openDashboard}
                                                disabled={openingDashboard}
                                                className="btn-primary inline-flex min-h-11 w-full items-center justify-center px-4 py-3 text-[10px] disabled:opacity-60 sm:w-auto"
                                            >
                                                {openingDashboard ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                                                Access Dashboard
                                            </button>
                                            <button
                                                type="button"
                                                onClick={closeModal}
                                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/70 text-muted-foreground transition hover:text-foreground"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {[
                                        ['Linked Accounts', detailData?.total_linked_accounts ?? 0],
                                        ['Transactions', detailData?.total_transactions ?? 0]
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className={popupInsetClass}>
                                            <p className="text-[10px] font-black text-muted-foreground">{label}</p>
                                            <p className="mt-3 text-2xl font-extrabold text-foreground">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className={popupSectionClass}>
                                    <button
                                        type="button"
                                        onClick={() => togglePopupSection('instagram')}
                                        className="flex w-full items-start justify-between gap-3 text-left"
                                    >
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Instagram accounts</h3>
                                            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                Linked accounts only. Toggle active state while respecting backend locking rules.
                                            </p>
                                        </div>
                                        {popupSections.instagram ? <ChevronUp className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {popupSections.instagram ? <div className="mt-4 space-y-3">
                                        {(detailData?.instagram_accounts || []).map((acc: any) => {
                                            const isAdminActive = String(acc.admin_status || 'active').trim().toLowerCase() === 'active';
                                            const isUserActive = String(acc.status || 'active').trim().toLowerCase() === 'active';
                                            const accessLabel = !isAdminActive
                                                ? 'Admin inactive'
                                                : !isUserActive
                                                    ? 'User inactive'
                                                    : acc.plan_locked === true
                                                        ? 'Locked by plan limit'
                                                        : 'Active';
                                            const tokenValidity = getInstagramTokenValidity(acc.token_expires_at);
                                            return (
                                                <div key={acc.$id} className="flex flex-col gap-3 rounded-[22px] border border-border/70 bg-background/72 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.45)] sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-bold text-foreground">{acc.username || acc.ig_user_id || acc.account_id}</p>
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    {accessLabel}
                                                                    {acc.plan_locked === true && isAdminActive && isUserActive ? ' - over plan active-account limit' : ''}
                                                                </p>
                                                            </div>
                                                            <div className="grid min-w-0 gap-2 rounded-[18px] border border-border/70 bg-card/80 px-3 py-2 text-xs sm:min-w-[240px]">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="font-semibold text-muted-foreground">Token status</span>
                                                                    <span
                                                                        className={cn(
                                                                            'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold',
                                                                            tokenValidity.tone === 'success' && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                                                                            tokenValidity.tone === 'warning' && 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
                                                                            tokenValidity.tone === 'danger' && 'bg-destructive/12 text-destructive',
                                                                            tokenValidity.tone === 'neutral' && 'bg-muted text-muted-foreground'
                                                                        )}
                                                                    >
                                                                        {tokenValidity.label}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="font-semibold text-muted-foreground">Valid until</span>
                                                                    <span className="text-right font-medium text-foreground">{formatExpiryLabel(acc.token_expires_at)}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="font-semibold text-muted-foreground">Validity</span>
                                                                    <span className="text-right font-medium text-foreground">{tokenValidity.detail}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                            <div className="rounded-[16px] border border-border/70 bg-card/70 px-3 py-2 text-xs">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hourly Credits</span>
                                                                <div className="mt-1 flex items-baseline justify-between gap-1">
                                                                    <span className="font-semibold text-foreground">
                                                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.max(0, Number(acc.allocated_hourly_credits ?? acc.hourly_action_limit ?? 100) - Number(acc.hourly_actions_used ?? 0)).toLocaleString()}</span>
                                                                        <span className="text-muted-foreground font-normal text-[11px]"> / {Number(acc.allocated_hourly_credits ?? acc.hourly_action_limit ?? 100).toLocaleString()}</span>
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium">Used: {Number(acc.hourly_actions_used ?? 0).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-[16px] border border-border/70 bg-card/70 px-3 py-2 text-xs">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily Credits</span>
                                                                <div className="mt-1 flex items-baseline justify-between gap-1">
                                                                    <span className="font-semibold text-foreground">
                                                                        {Number(acc.allocated_daily_credits ?? acc.daily_action_limit ?? 1000) <= 0 ? (
                                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Unlimited</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.max(0, Number(acc.allocated_daily_credits ?? acc.daily_action_limit ?? 1000) - Number(acc.daily_actions_used ?? 0)).toLocaleString()}</span>
                                                                                <span className="text-muted-foreground font-normal text-[11px]"> / {Number(acc.allocated_daily_credits ?? acc.daily_action_limit ?? 1000).toLocaleString()}</span>
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium">Used: {Number(acc.daily_actions_used ?? 0).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-[16px] border border-border/70 bg-card/70 px-3 py-2 text-xs">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly Credits</span>
                                                                <div className="mt-1 flex items-baseline justify-between gap-1">
                                                                    <span className="font-semibold text-foreground">
                                                                        {Number(acc.allocated_monthly_credits ?? acc.monthly_action_limit ?? 25000) <= 0 ? (
                                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Unlimited</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.max(0, Number(acc.allocated_monthly_credits ?? acc.monthly_action_limit ?? 25000) - Number(acc.monthly_actions_used ?? 0)).toLocaleString()}</span>
                                                                                <span className="text-muted-foreground font-normal text-[11px]"> / {Number(acc.allocated_monthly_credits ?? acc.monthly_action_limit ?? 25000).toLocaleString()}</span>
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium">Used: {Number(acc.monthly_actions_used ?? 0).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-end gap-2.5 sm:self-stretch">
                                                        <button
                                                            type="button"
                                                            role="switch"
                                                            aria-checked={isAdminActive}
                                                            disabled={accountToggleLoadingId === acc.$id}
                                                            onClick={() => void toggleInstagramAccountAccess(acc)}
                                                            className="inline-flex items-center gap-3 disabled:opacity-60"
                                                        >
                                                            {accountToggleLoadingId === acc.$id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Shield className="h-4 w-4 text-muted-foreground" />}
                                                            <span
                                                                className={cn(
                                                                    'relative h-7 w-12 rounded-full transition-colors',
                                                                    isAdminActive ? 'bg-success/70' : 'bg-muted'
                                                                )}
                                                            >
                                                                <span
                                                                    className={cn(
                                                                        'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                                                                        isAdminActive ? 'left-6' : 'left-1'
                                                                    )}
                                                                />
                                                            </span>
                                                            <span className="text-xs font-semibold text-foreground">
                                                                {isAdminActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPendingDeleteInstagramAccount(acc);
                                                                setDeleteInstagramConfirmText('');
                                                                setShowDeleteInstagramDialog(true);
                                                            }}
                                                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive transition hover:bg-destructive/15"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!detailData?.instagram_accounts || detailData.instagram_accounts.length === 0) && (
                                            <p className="text-xs text-muted-foreground">No linked accounts</p>
                                        )}
                                    </div> : null}
                                </div>

                                <div className={popupSectionClass}>
                                    <button
                                        type="button"
                                        onClick={() => togglePopupSection('ban')}
                                        className="flex w-full items-start justify-between gap-3 text-left"
                                    >
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Ban</h3>
                                            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                Banning can disable access and stop automation processing depending on selected mode.
                                            </p>
                                        </div>
                                        {popupSections.ban ? <ChevronUp className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {popupSections.ban ? <div className="mt-4 space-y-3">
                                        <div className="flex flex-wrap gap-3">
                                            {(['none', 'soft', 'hard'] as const).map((mode) => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setBanMode(mode)}
                                                    className={cn('segmented-option', banMode === mode ? 'is-active' : '')}
                                                    type="button"
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Soft Ban vs Hard Ban Clear System Explanation */}
                                        <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3 text-xs">
                                            <div className="flex items-center gap-2 font-bold text-foreground">
                                                <Shield className="h-4 w-4 text-primary" />
                                                <span>Ban Modes & System Effects</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className={cn("p-3 rounded-xl border transition-all", banMode === 'none' ? "border-emerald-500/50 bg-emerald-500/10 shadow-xs" : "border-border/60 bg-card/60")}>
                                                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                        <span>None (Active)</span>
                                                    </div>
                                                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                                                        Full regular access. User can log in, edit automations, and all background automation workers trigger normally.
                                                    </p>
                                                </div>
                                                <div className={cn("p-3 rounded-xl border transition-all", banMode === 'soft' ? "border-amber-500/50 bg-amber-500/10 shadow-xs" : "border-border/60 bg-card/60")}>
                                                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                                                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                                                        <span>Soft Ban</span>
                                                    </div>
                                                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                                                        <strong>Dashboard Accessible:</strong> User can still log in, review account settings, and inspect analytics.
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                                                        <strong>Automations Locked:</strong> Automation editing is restricted with a warning modal, and background workers immediately stop executing triggers.
                                                    </p>
                                                </div>
                                                <div className={cn("p-3 rounded-xl border transition-all", banMode === 'hard' ? "border-destructive/50 bg-destructive/10 shadow-xs" : "border-border/60 bg-card/60")}>
                                                    <div className="flex items-center gap-1.5 font-bold text-destructive">
                                                        <span className="h-2 w-2 rounded-full bg-destructive" />
                                                        <span>Hard Ban</span>
                                                    </div>
                                                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                                                        <strong>Immediate Revocation:</strong> Active session cookies and tokens are revoked instantly.
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                                                        <strong>Access Blocked:</strong> Login attempts are rejected with HTTP 403. All worker jobs and automated actions are completely blocked.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <input
                                            className="input-base"
                                            placeholder="Ban reason"
                                            value={banReason}
                                            onChange={(event) => setBanReason(event.target.value)}
                                        />
                                        <button onClick={() => { setBanConfirmText(''); setShowBanConfirmDialog(true); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-[10px] font-black text-white transition hover:bg-destructive/90 disabled:opacity-60" disabled={saving || isDeletingUser}>
                                            <Ban className="h-4 w-4" />
                                            Ban User
                                        </button>
                                    </div> : null}
                                </div>

                                <div className={popupSectionClass}>
                                    <button
                                        type="button"
                                        onClick={() => togglePopupSection('danger')}
                                        className="flex w-full items-center justify-between gap-3 text-left"
                                    >
                                        <h3 className="text-sm font-bold text-foreground">Delete user</h3>
                                        {popupSections.danger ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {popupSections.danger ? (
                                        <div className="mt-4 border-t border-border/70 pt-4 space-y-3">
                                            {isTargetSelfOrAdmin ? (
                                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    Administrative accounts cannot be deleted through the admin panel.
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setDeleteConfirmText('');
                                                        setShowDeleteUserDialog(true);
                                                    }}
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-[10px] font-black text-destructive disabled:opacity-60"
                                                    disabled={saving || isDeletingUser || isTargetSelfOrAdmin}
                                                >
                                                    {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    Delete User
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </section>
                </div>
                </div>
            )}

            <ConfirmDialog
                open={showBanConfirmDialog}
                title="Confirm ban action?"
                description={(
                    <div className="space-y-2">
                        <p>This will apply the selected ban mode immediately.</p>
                        <p className="font-semibold text-foreground">Mode: {banMode}</p>
                        {banReason ? <p>Reason: {banReason}</p> : null}
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground">Type BAN to confirm</label>
                            <input
                                className="input-base mt-2"
                                value={banConfirmText}
                                onChange={(event) => setBanConfirmText(event.target.value)}
                                placeholder="BAN"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}
                confirmLabel="Confirm Ban User"
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

            <ConfirmDialog
                open={showDeleteInstagramDialog}
                title="Delete linked Instagram account?"
                description={(
                    <div className="space-y-3">
                        <p>
                            {pendingDeleteInstagramAccount
                                ? `This will permanently remove @${pendingDeleteInstagramAccount.username || pendingDeleteInstagramAccount.ig_user_id || pendingDeleteInstagramAccount.account_id} and delete its related automation data.`
                                : 'This will permanently remove the linked Instagram account and related data.'}
                        </p>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground">Type REMOVE to confirm</label>
                            <input
                                className="input-base mt-2"
                                value={deleteInstagramConfirmText}
                                onChange={(event) => setDeleteInstagramConfirmText(event.target.value)}
                                placeholder="REMOVE"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}
                confirmLabel="Delete Instagram Account"
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

            <ConfirmDialog
                open={showDeleteUserDialog}
                title="Delete user permanently?"
                description={(
                    <div className="space-y-3">
                        <p>{selectedUser ? `This will permanently delete ${selectedUser.email || selectedUser.name || 'this user'} and remove their dashboard access. This action cannot be undone.` : ''}</p>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground">Type DELETE to confirm</label>
                            <input
                                className="input-base mt-2"
                                value={deleteConfirmText}
                                onChange={(event) => setDeleteConfirmText(event.target.value)}
                                placeholder="DELETE"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                )}
                confirmLabel="Delete User"
                cancelLabel="Keep User"
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
