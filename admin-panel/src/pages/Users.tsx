import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Ban,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
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

const getMinDateTimeInputValue = () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseFeatureOverrides = (raw: unknown): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, any>;
    try {
        const parsed = JSON.parse(String(raw || ''));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const surfaceClass = 'glass-card rounded-[32px] border border-border/80 bg-card/95 shadow-sm';

const SelectField = ({
    label,
    value,
    onChange,
    children,
    hint
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
    hint?: string;
}) => (
    <div className="rounded-[24px] border border-border/70 bg-gradient-to-b from-background/80 to-card/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{hint}</p> : null}
        <div className="relative mt-3">
            <select
                className="select-modern bg-card/90 text-foreground pr-11 shadow-sm"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    </div>
);

export const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const { userId } = useParams<{ userId: string }>();

    const [users, setUsers] = useState<UserRow[]>([]);
    const [pricingPlans, setPricingPlans] = useState<Array<{ id: string; name: string; plan_code: string }>>([]);
    const [loading, setLoading] = useState(true);
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
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);
    const [profilePatch, setProfilePatch] = useState<any>({});
    const [banMode, setBanMode] = useState<'none' | 'soft' | 'hard'>('none');
    const [banReason, setBanReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [planTermMode, setPlanTermMode] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
    const [accountToggleLoadingId, setAccountToggleLoadingId] = useState<string | null>(null);
    const [openingDashboard, setOpeningDashboard] = useState(false);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setPagination((current) => ({ ...current, page: 1 }));
        }, 280);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const fetchPricingPlans = async () => {
        try {
            const response = await httpClient.get('/api/admin/pricing');
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
            setLoading(false);
        }
    };

    const loadUserDetail = async (targetUserId: string) => {
        setDetailLoading(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.get(`/api/admin/users/${targetUserId}`);
            setDetailData(response.data);
            const profile = response.data?.profile || {};
            const featureOverrides = parseFeatureOverrides(profile.feature_overrides_json);
            const limits = parseFeatureOverrides(profile.limits_json);
            setProfilePatch({
                action: 'change_assigned_plan',
                instagram_connections_limit: limits.instagram_connections_limit ?? response.data?.effective_limits?.instagram_connections_limit ?? '',
                hourly_action_limit: limits.hourly_action_limit ?? profile.hourly_action_limit ?? '',
                daily_action_limit: limits.daily_action_limit ?? profile.daily_action_limit ?? '',
                monthly_action_limit: limits.monthly_action_limit ?? profile.monthly_action_limit ?? '',
                no_watermark: featureOverrides.no_watermark === true,
                feature_overrides_json: profile.feature_overrides_json || '',
                watermark_text: String(featureOverrides?.watermark_text || '').trim(),
                plan_code: profile.plan_code || profile.subscription_plan_id || 'free',
                plan_status: profile.plan_status || profile.subscription_status || 'inactive',
                billing_cycle: profile.billing_cycle || profile.subscription_billing_cycle || 'monthly',
                duration_days: '',
                custom_expiry_date: profile.expires_at ? String(profile.expires_at).slice(0, 16) : '',
                kill_switch_enabled: response.data?.user?.kill_switch_enabled !== false
            });
            setPlanTermMode(
                profile.billing_cycle === 'yearly'
                    ? 'yearly'
                    : (profile.expires_at && !profile.billing_cycle ? 'custom' : 'monthly')
            );
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
            return;
        }
        void loadUserDetail(userId);
    }, [userId]);

    const selectedUser = useMemo(
        () => users.find((entry) => entry.$id === userId) || detailData?.user || null,
        [detailData?.user, userId, users]
    );

    const closeModal = () => navigate('/users');

    const applyProfileAction = async (
        action: 'change_assigned_plan' | 'edit_custom_limits' | 'reset_to_assigned_defaults' | 'reset_to_paid_snapshot_or_free'
    ) => {
        if (!selectedUser) return;
        setSaving(true);
        setErrorMessage(null);
        try {
            const payload = { ...profilePatch, action } as Record<string, any>;
            if (action === 'change_assigned_plan') {
                if (planTermMode === 'custom') {
                    payload.billing_cycle = profilePatch.billing_cycle || 'monthly';
                } else {
                    payload.billing_cycle = planTermMode;
                    payload.custom_expiry_date = '';
                    payload.duration_days = '';
                }
            }
            const overrides = parseFeatureOverrides(payload.feature_overrides_json);
            const watermarkText = String(payload.watermark_text || '').trim();
            if (watermarkText) overrides.watermark_text = watermarkText;
            else delete overrides.watermark_text;
            if (payload.no_watermark === true) overrides.no_watermark = true;
            else delete overrides.no_watermark;
            payload.feature_overrides_json = Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : '';
            payload.no_watermark = payload.no_watermark === true;
            delete payload.watermark_text;

            if (action === 'reset_to_assigned_defaults' || action === 'reset_to_paid_snapshot_or_free') {
                await httpClient.post(`/api/admin/users/${selectedUser.$id}/reset-plan`, { action });
            } else {
                await httpClient.patch(`/api/admin/users/${selectedUser.$id}/profile`, payload);
            }

            await Promise.all([fetchUsers(pagination.page), loadUserDetail(selectedUser.$id)]);
            setNotice(
                action === 'change_assigned_plan'
                    ? 'Assigned plan updated.'
                    : action === 'edit_custom_limits'
                        ? 'Custom limits updated.'
                        : action === 'reset_to_assigned_defaults'
                            ? 'Default limits restored.'
                            : 'Reset to default completed.'
            );
        } catch (error) {
            console.error('Failed to update profile:', error);
            setErrorMessage('Failed to update profile action.');
        } finally {
            setSaving(false);
        }
    };

    const saveBan = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setErrorMessage(null);
        try {
            await httpClient.post(`/api/admin/users/${selectedUser.$id}/ban`, {
                mode: banMode,
                reason: banReason,
                kill_switch_enabled: profilePatch.kill_switch_enabled !== false
            });
            await Promise.all([fetchUsers(pagination.page), loadUserDetail(selectedUser.$id)]);
            setNotice('Ban status updated.');
        } catch (error) {
            console.error('Failed to update ban status:', error);
            setErrorMessage('Failed to update ban status.');
        } finally {
            setSaving(false);
        }
    };

    const toggleInstagramAccountAccess = async (account: any) => {
        if (!selectedUser || !account?.$id) return;
        setAccountToggleLoadingId(account.$id);
        setErrorMessage(null);
        try {
            const enabling = account.effective_access !== true;
            await httpClient.patch(`/api/admin/users/${selectedUser.$id}/instagram-accounts/${account.$id}`, enabling
                ? {
                    admin_disabled: false,
                    access_override_enabled: account.plan_locked === true
                }
                : {
                    admin_disabled: true,
                    access_override_enabled: false
                });
            await Promise.all([fetchUsers(pagination.page), loadUserDetail(selectedUser.$id)]);
            setNotice(enabling ? 'Instagram account access enabled.' : 'Instagram account access disabled.');
        } catch (error) {
            console.error('Failed to update Instagram account access:', error);
            setErrorMessage('Failed to update Instagram account access.');
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

        setIsDeletingUser(true);
        setErrorMessage(null);
        setNotice(null);

        try {
            await httpClient.delete(`/api/admin/users/${selectedUser.$id}`);
            await fetchUsers(Math.max(1, Math.min(pagination.page, pagination.total_pages)));
            setNotice('User deleted permanently.');
            setShowDeleteUserDialog(false);
            closeModal();
        } catch (error: any) {
            console.error('Failed to delete user:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to delete user.');
        } finally {
            setIsDeletingUser(false);
        }
    };

    if (loading && users.length === 0) {
        return <AdminLoadingState title="Loading users" description="Preparing user records, subscription details, and moderation controls." />;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">Users</p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">User Management</h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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

            {(notice || errorMessage) && (
                <div className={cn(
                    'rounded-[24px] border px-5 py-4 text-sm font-semibold',
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
                        <h2 className="text-xl font-extrabold text-foreground">All Users</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Paginated results with debounced search and server-side filtering.
                        </p>
                    </div>
                    <div className="status-pill border border-border bg-background/70 text-foreground">
                        {pagination.total} matching users
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/70 bg-background/40">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">User</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Plan</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">IG Accounts</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Ban</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Action</th>
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
                                        <td className="min-w-[240px] px-6 py-5">
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
                                        <td className="px-6 py-5 text-xs font-bold text-foreground">
                                            {user.profile?.plan_code || user.profile?.subscription_plan_id || 'free'}
                                        </td>
                                        <td className="px-6 py-5 text-xs font-bold text-foreground">
                                            {user.linked_instagram_accounts ?? 0}
                                        </td>
                                        <td className="px-6 py-5">
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
                                        <td className="px-6 py-5 text-right">
                                            <Link to={`/users/${user.$id}`} className="btn-secondary px-4 py-2 text-[10px]">
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

                <div className="flex flex-col gap-4 border-t border-border/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        Page {pagination.page} of {pagination.total_pages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void fetchUsers(Math.max(1, pagination.page - 1))}
                            disabled={!pagination.has_previous || loading}
                            className="btn-secondary px-4 py-2 text-[10px] disabled:opacity-60"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() => void fetchUsers(pagination.page + 1)}
                            disabled={!pagination.has_next || loading}
                            className="btn-secondary px-4 py-2 text-[10px] disabled:opacity-60"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>

            {userId && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
                    <button type="button" className="absolute inset-0" aria-label="Close user manager" onClick={closeModal} />
                    <section className={`${surfaceClass} custom-scrollbar relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto p-6 sm:p-7`}>
                        {detailLoading ? (
                            <AdminLoadingState title="Loading user details" description="Fetching profile overrides, account links, and moderation state." className="min-h-[320px]" />
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            Back to users
                                        </button>
                                        <h2 className="mt-3 text-2xl font-extrabold text-foreground">{detailData?.user?.name || selectedUser?.name}</h2>
                                        <p className="break-all text-sm text-muted-foreground">{detailData?.user?.email || selectedUser?.email}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={openDashboard}
                                            disabled={openingDashboard}
                                            className="btn-primary px-4 py-3 text-[10px] disabled:opacity-60"
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

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {[
                                        ['Effective Plan', detailData?.effective_plan?.name || 'Free'],
                                        ['Latest plan', detailData?.latest_subscribed_plan?.plan_name || 'Free'],
                                        ['IG Connections', detailData?.effective_limits?.instagram_connections_limit ?? 0],
                                        ['Transactions', detailData?.total_transactions ?? 0]
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className="rounded-[24px] border border-border/70 bg-background/50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                                            <p className="mt-3 text-2xl font-extrabold text-foreground">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    <div className="rounded-[24px] border border-border/70 bg-background/50 p-5">
                                        <h3 className="text-sm font-bold text-foreground">Assigned plan</h3>
                                        <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                            Set the user&apos;s current assigned plan and expiry window here.
                                        </p>
                                        <div className="mt-4 space-y-3">
                                            <SelectField
                                                label="Assigned plan"
                                                hint="Choose the canonical plan for this user."
                                                value={profilePatch.plan_code || 'free'}
                                                onChange={(value) => setProfilePatch((prev: any) => ({ ...prev, plan_code: value }))}
                                            >
                                                <option value="free">Free Plan</option>
                                                {pricingPlans
                                                    .filter((plan) => String(plan.plan_code || plan.id).trim().toLowerCase() !== 'free')
                                                    .map((plan) => (
                                                    <option key={plan.id} value={plan.plan_code || plan.id}>{plan.name}</option>
                                                ))}
                                            </SelectField>
                                            <SelectField
                                                label="Plan status"
                                                hint={detailData?.plan_status_help?.description || 'Set the live access lifecycle for this user.'}
                                                value={profilePatch.plan_status || 'inactive'}
                                                onChange={(value) => setProfilePatch((prev: any) => ({ ...prev, plan_status: value }))}
                                            >
                                                <option value="inactive">Inactive</option>
                                                <option value="active">Active</option>
                                                <option value="expired">Expired</option>
                                            </SelectField>
                                            <div className="rounded-[24px] border border-border/70 bg-background/55 p-4">
                                                <p className="text-xs font-semibold text-muted-foreground">Plan term</p>
                                                <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">Choose monthly, yearly, or a custom expiry date.</p>
                                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    {([
                                                        ['monthly', 'Monthly'],
                                                        ['yearly', 'Yearly'],
                                                        ['custom', 'Custom date']
                                                    ] as const).map(([mode, label]) => (
                                                        <button
                                                            key={mode}
                                                            type="button"
                                                            onClick={() => setPlanTermMode(mode)}
                                                            className={cn('segmented-option justify-center', planTermMode === mode ? 'is-active' : '')}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {planTermMode === 'custom' ? (
                                                    <input
                                                        type="datetime-local"
                                                        className="input-base mt-3"
                                                        value={profilePatch.custom_expiry_date ?? ''}
                                                        onChange={(event) => setProfilePatch((prev: any) => ({ ...prev, custom_expiry_date: event.target.value }))}
                                                        min={getMinDateTimeInputValue()}
                                                    />
                                                ) : null}
                                            </div>
                                            <button onClick={() => applyProfileAction('change_assigned_plan')} className="btn-primary w-full px-4 py-3 text-[10px]" disabled={saving || isDeletingUser}>
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                Save assigned plan
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-[24px] border border-border/70 bg-background/50 p-5">
                                        <h3 className="text-sm font-bold text-foreground">Custom limits and watermark</h3>
                                        <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                            These profile-level settings change runtime behavior without editing pricing defaults.
                                        </p>
                                        <div className="mt-4 space-y-3">
                                            {[
                                                ['instagram_connections_limit', 'Instagram connections'],
                                                ['hourly_action_limit', 'Hourly actions'],
                                                ['daily_action_limit', 'Daily actions'],
                                                ['monthly_action_limit', 'Monthly actions']
                                            ].map(([key, label]) => (
                                                <div key={key}>
                                                    <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                                                    <input
                                                        className="input-base mt-2"
                                                        value={profilePatch[key] ?? ''}
                                                        onChange={(event) => setProfilePatch((prev: any) => ({ ...prev, [key]: event.target.value }))}
                                                    />
                                                </div>
                                            ))}
                                            <div className="rounded-[18px] border border-border/70 bg-card/70 px-4 py-4">
                                                <p className="text-xs font-semibold text-muted-foreground">Watermark override</p>
                                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        className={cn('segmented-option min-h-[84px] flex-col items-start rounded-[20px] p-4 text-left', !profilePatch.no_watermark ? 'is-active' : '')}
                                                        onClick={() => setProfilePatch((prev: any) => ({ ...prev, no_watermark: false }))}
                                                    >
                                                        <span className="segmented-dot" />
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">Watermark on</p>
                                                            <p className="mt-1 text-xs font-medium text-muted-foreground">Keep the shared watermark active for this user.</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cn('segmented-option min-h-[84px] flex-col items-start rounded-[20px] p-4 text-left', profilePatch.no_watermark ? 'is-active' : '')}
                                                        onClick={() => setProfilePatch((prev: any) => ({ ...prev, no_watermark: true }))}
                                                    >
                                                        <span className="segmented-dot" />
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">Watermark off</p>
                                                            <p className="mt-1 text-xs font-medium text-muted-foreground">Allow replies without the shared watermark.</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                            <button onClick={() => applyProfileAction('edit_custom_limits')} className="btn-primary w-full px-4 py-3 text-[10px]" disabled={saving || isDeletingUser}>
                                                Save limits and watermark
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    <div className="rounded-[24px] border border-border/70 bg-background/50 p-5">
                                        <h3 className="text-sm font-bold text-foreground">Ban controls</h3>
                                        <div className="mt-4 flex flex-wrap gap-3">
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
                                        <input
                                            className="input-base mt-3"
                                            placeholder="Ban reason"
                                            value={banReason}
                                            onChange={(event) => setBanReason(event.target.value)}
                                        />
                                        <div className="mt-3 rounded-[18px] border border-border/70 bg-card/70 px-4 py-4">
                                                <p className="text-xs font-semibold text-muted-foreground">Kill switch</p>
                                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <button
                                                    type="button"
                                                    className={cn('segmented-option min-h-[84px] flex-col items-start rounded-[20px] p-4 text-left', profilePatch.kill_switch_enabled !== false ? 'is-active' : '')}
                                                    onClick={() => setProfilePatch((prev: any) => ({ ...prev, kill_switch_enabled: true }))}
                                                >
                                                    <span className="segmented-dot" />
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">Enabled</p>
                                                        <p className="mt-1 text-xs font-medium text-muted-foreground">Worker processing can continue for linked accounts.</p>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={cn('segmented-option min-h-[84px] flex-col items-start rounded-[20px] p-4 text-left', profilePatch.kill_switch_enabled === false ? 'is-active' : '')}
                                                    onClick={() => setProfilePatch((prev: any) => ({ ...prev, kill_switch_enabled: false }))}
                                                >
                                                    <span className="segmented-dot" />
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">Disabled</p>
                                                        <p className="mt-1 text-xs font-medium text-muted-foreground">Worker processing stops before any automation checks.</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                        <button onClick={saveBan} className="btn-primary mt-3 w-full px-4 py-3 text-[10px]" disabled={saving || isDeletingUser}>
                                            <Ban className="h-4 w-4" />
                                            Save ban and kill switch
                                        </button>
                                    </div>

                                    <div className="rounded-[24px] border border-border/70 bg-background/50 p-5">
                                        <h3 className="text-sm font-bold text-foreground">Resets and linked accounts</h3>
                                        <div className="mt-4 space-y-3">
                                            <div className="rounded-[20px] border border-border/70 bg-card/70 p-4">
                                                <button onClick={() => applyProfileAction('reset_to_assigned_defaults')} className="btn-secondary w-full px-4 py-3 text-[10px]" disabled={saving || isDeletingUser}>
                                                    Restore Default limits
                                                </button>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Reapply the selected plan defaults while keeping the current user record intact.
                                                </p>
                                            </div>
                                            <div className="rounded-[20px] border border-border/70 bg-card/70 p-4">
                                                <button onClick={() => applyProfileAction('reset_to_paid_snapshot_or_free')} className="btn-secondary w-full px-4 py-3 text-[10px]" disabled={saving || isDeletingUser}>
                                                    Reset to default
                                                </button>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Restore the latest paid self-subscription snapshot, or fall back to free when none exists.
                                                </p>
                                            </div>
                                            <div className="rounded-[20px] border border-border/70 bg-card/70 p-4">
                                                <p className="text-xs font-semibold text-muted-foreground">Linked Instagram accounts</p>
                                                <div className="mt-3 space-y-3">
                                                    {(detailData?.instagram_accounts || []).map((acc: any) => {
                                                        const accessLabel = acc.status !== 'active'
                                                            ? 'Unlinked'
                                                            : acc.effective_access === true
                                                                ? (acc.access_state === 'override_enabled' ? 'Override enabled' : 'Enabled')
                                                                : acc.access_state === 'plan_locked'
                                                                    ? 'Plan locked'
                                                                    : 'Admin disabled';
                                                        return (
                                                            <div key={acc.$id} className="flex flex-col gap-3 rounded-[18px] border border-border/70 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-bold text-foreground">{acc.username || acc.ig_user_id || acc.account_id}</p>
                                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                                        {accessLabel}
                                                                        {acc.access_reason ? ` - ${String(acc.access_reason).replace(/_/g, ' ')}` : ''}
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    role="switch"
                                                                    aria-checked={acc.effective_access === true}
                                                                    disabled={accountToggleLoadingId === acc.$id || acc.status !== 'active'}
                                                                    onClick={() => void toggleInstagramAccountAccess(acc)}
                                                                    className="inline-flex items-center gap-3 disabled:opacity-60"
                                                                >
                                                                    {accountToggleLoadingId === acc.$id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Shield className="h-4 w-4 text-muted-foreground" />}
                                                                    <span
                                                                        className={cn(
                                                                            'relative h-7 w-12 rounded-full transition-colors',
                                                                            acc.effective_access === true ? 'bg-success/70' : 'bg-muted'
                                                                        )}
                                                                    >
                                                                        <span
                                                                            className={cn(
                                                                                'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                                                                                acc.effective_access === true ? 'left-6' : 'left-1'
                                                                            )}
                                                                        />
                                                                    </span>
                                                                    <span className="text-xs font-semibold text-foreground">
                                                                        {acc.effective_access === true ? 'Enabled' : 'Disabled'}
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                    {(!detailData?.instagram_accounts || detailData.instagram_accounts.length === 0) && (
                                                        <p className="text-xs text-muted-foreground">No linked accounts</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
                                    <button
                                        onClick={() => setShowDeleteUserDialog(true)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-destructive disabled:opacity-60"
                                        disabled={saving || isDeletingUser}
                                    >
                                        {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        Delete User
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}
            <ConfirmDialog
                open={showDeleteUserDialog}
                title="Delete user permanently?"
                description={selectedUser ? `This will permanently delete ${selectedUser.email || selectedUser.name || 'this user'} and remove their dashboard access. This action cannot be undone.` : ''}
                confirmLabel="Delete User"
                cancelLabel="Keep User"
                tone="danger"
                loading={isDeletingUser}
                onCancel={() => {
                    if (!isDeletingUser) {
                        setShowDeleteUserDialog(false);
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
