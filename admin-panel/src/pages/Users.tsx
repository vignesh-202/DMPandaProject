import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Ban,
    CheckCircle2,
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

const getMinDateTimeInputValue = () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatExpiryLabel = (value?: string | null) => {
    if (!value) return 'No expiry';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'No expiry' : parsed.toLocaleString();
};

const describeFreePlanMode = (planCode?: string | null, expiryDate?: string | null) => {
    if (String(planCode || 'free').trim().toLowerCase() !== 'free') return null;
    return expiryDate
        ? `Temporary Free (expires on ${formatExpiryLabel(expiryDate)})`
        : 'Permanent Free';
};

const normalizePlanIdentifier = (value: unknown): string => String(value || '').trim().toLowerCase();
const resolveNoWatermarkFromPlan = (plan?: PricingPlanOption | null): boolean => {
    if (!plan) return false;
    if (plan.entitlements && typeof plan.entitlements === 'object') {
        return plan.entitlements.no_watermark === true;
    }
    if (Array.isArray(plan.benefits)) {
        const benefit = plan.benefits.find((item) => String(item?.key || '').trim().toLowerCase() === 'no_watermark');
        if (benefit) return benefit.enabled === true;
    }
    return false;
};

const LIMIT_FIELDS = [
    'instagram_connections_limit',
    'hourly_action_limit',
    'daily_action_limit',
    'monthly_action_limit'
] as const;
type LimitField = (typeof LIMIT_FIELDS)[number];
type PopupSectionKey = 'planSettings' | 'instagram' | 'ban' | 'danger';
type ResetActionState = 'resetPlan' | 'restoreLimits' | null;

const toComparableValue = (value: unknown) => String(value ?? '').trim();

const surfaceClass = 'glass-card rounded-[32px] border border-border/80 bg-card/95 shadow-sm';
const popupSectionClass = 'rounded-[28px] border border-border/80 bg-card/90 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl';
const popupInsetClass = 'rounded-[22px] border border-border/70 bg-background/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const popupHeaderBandClass = 'rounded-[24px] border border-border/70 bg-gradient-to-br from-background via-background/96 to-muted/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
const DEFAULT_POPUP_SECTION_STATE: Record<PopupSectionKey, boolean> = {
    planSettings: false,
    instagram: false,
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
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);
    const [profilePatch, setProfilePatch] = useState<any>({});
    const [lastSyncedProfilePatch, setLastSyncedProfilePatch] = useState<any | null>(null);
    const [banMode, setBanMode] = useState<'none' | 'soft' | 'hard'>('none');
    const [banReason, setBanReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetActionLoading, setResetActionLoading] = useState<ResetActionState>(null);
    const [planTermMode, setPlanTermMode] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
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
            setHasLoadedUsersOnce(true);
            setLoading(false);
        }
    };

    const resolvePlanTermMode = (planCode?: string | null, expiryDate?: string | null): 'monthly' | 'yearly' | 'custom' => (
        expiryDate ? 'custom' : (String(planCode || 'free').toLowerCase() === 'free' ? 'custom' : 'monthly')
    );

    const loadUserDetail = async (targetUserId: string) => {
        setDetailLoading(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.get(`/api/admin/users/${targetUserId}`);
            setDetailData(response.data);
            const profile = response.data?.profile || {};
            const resolvedTermMode = resolvePlanTermMode(profile.plan_code, profile.expiry_date);
            const nextPatch = {
                action: 'change_assigned_plan',
                instagram_connections_limit: resolveNumericField(profile.instagram_connections_limit, response.data?.effective_limits?.instagram_connections_limit),
                hourly_action_limit: resolveNumericField(profile.hourly_action_limit, response.data?.effective_limits?.hourly_action_limit),
                daily_action_limit: resolveNumericField(profile.daily_action_limit, response.data?.effective_limits?.daily_action_limit),
                monthly_action_limit: resolveNumericField(profile.monthly_action_limit, response.data?.effective_limits?.monthly_action_limit),
                no_watermark: resolveNoWatermarkValue(response.data),
                plan_code: profile.plan_code || response.data?.effective_plan?.plan_code || 'free',
                duration_mode: resolvedTermMode,
                custom_expiry_date: profile.expiry_date ? String(profile.expiry_date).slice(0, 16) : '',
                kill_switch_enabled: response.data?.user?.kill_switch_enabled !== false
            };
            setProfilePatch(nextPatch);
            setPlanTermMode(resolvedTermMode);
            setLastSyncedProfilePatch(buildTrackedSnapshot(nextPatch, resolvedTermMode));
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

    const closeModal = () => navigate('/users');
    const togglePopupSection = (section: PopupSectionKey) => {
        setPopupSections((prev) => ({
            ...prev,
            [section]: !prev[section]
        }));
    };
    const resolveNumericField = (...values: unknown[]) => {
        for (const value of values) {
            if (value === null || value === undefined || value === '') continue;
            return value;
        }
        return 0;
    };
    const resolvePlanOptionValue = (value: unknown, fallback: string = 'free'): string => {
        const normalized = normalizePlanIdentifier(value);
        if (!normalized) return normalizePlanIdentifier(fallback) || 'free';
        if (normalized === 'free') return 'free';
        const matchedPlan = pricingPlans.find((plan) => {
            const code = normalizePlanIdentifier(plan.plan_code);
            const id = normalizePlanIdentifier(plan.id);
            return normalized === code || normalized === id;
        });
        if (!matchedPlan) return normalized;
        return normalizePlanIdentifier(matchedPlan.plan_code || matchedPlan.id || normalized);
    };
    const currentPlanCode = String(detailData?.subscription_summary?.plan_code || detailData?.profile?.plan_code || 'free').trim().toLowerCase();
    const currentExpiryDate = detailData?.subscription_summary?.expiry_date || detailData?.profile?.expiry_date || null;
    const selectedPlanCode = resolvePlanOptionValue(profilePatch.plan_code || detailData?.subscription_summary?.plan_code || 'free');
    const freePlanModeLabel = describeFreePlanMode(currentPlanCode, currentExpiryDate);

    const getPlanDefaults = (planCodeOrId: string) => {
        const normalized = resolvePlanOptionValue(planCodeOrId, 'free');
        const selectedPlan = pricingPlans.find((plan) => {
            const code = normalizePlanIdentifier(plan.plan_code);
            const id = normalizePlanIdentifier(plan.id);
            return normalized === code || normalized === id;
        });
        if (!selectedPlan) return null;
        return {
            instagram_connections_limit: resolveNumericField(
                selectedPlan.instagram_connections_limit,
                (selectedPlan as any).instagram_link_limit,
                0
            ),
            hourly_action_limit: resolveNumericField(
                selectedPlan.actions_per_hour_limit,
                (selectedPlan as any).hourly_action_limit,
                0
            ),
            daily_action_limit: resolveNumericField(
                selectedPlan.actions_per_day_limit,
                (selectedPlan as any).daily_action_limit,
                0
            ),
            monthly_action_limit: resolveNumericField(
                selectedPlan.actions_per_month_limit,
                (selectedPlan as any).monthly_action_limit,
                0
            ),
            no_watermark: resolveNoWatermarkFromPlan(selectedPlan)
        };
    };

    const resolveNoWatermarkValue = (payload: any) => {
        const effectiveEntitlements = payload?.effective_entitlements || {};
        const effectiveLimits = payload?.effective_limits || {};
        const responseProfile = payload?.profile || {};
        if (effectiveEntitlements?.no_watermark !== undefined) {
            return effectiveEntitlements.no_watermark === true;
        }
        if (effectiveLimits?.no_watermark !== undefined) {
            return effectiveLimits.no_watermark === true;
        }
        return responseProfile?.no_watermark === true;
    };

    const buildSyncedProfilePatch = (payload: any): any => {
        const responseProfile = payload?.profile || {};
        const responseLimits = payload?.effective_limits || {};
        return {
            action: 'change_assigned_plan',
            instagram_connections_limit: resolveNumericField(
                responseLimits?.instagram_connections_limit,
                responseProfile?.instagram_connections_limit,
                detailData?.profile?.instagram_connections_limit,
                profilePatch?.instagram_connections_limit
            ),
            hourly_action_limit: resolveNumericField(
                responseLimits?.hourly_action_limit,
                responseProfile?.hourly_action_limit,
                detailData?.profile?.hourly_action_limit,
                profilePatch?.hourly_action_limit
            ),
            daily_action_limit: resolveNumericField(
                responseLimits?.daily_action_limit,
                responseProfile?.daily_action_limit,
                detailData?.profile?.daily_action_limit,
                profilePatch?.daily_action_limit
            ),
            monthly_action_limit: resolveNumericField(
                responseLimits?.monthly_action_limit,
                responseProfile?.monthly_action_limit,
                detailData?.profile?.monthly_action_limit,
                profilePatch?.monthly_action_limit
            ),
            no_watermark: resolveNoWatermarkValue(payload),
            plan_code: resolvePlanOptionValue(
                responseProfile?.plan_code
                || payload?.effective_plan?.plan_code
                || profilePatch?.plan_code
                || detailData?.profile?.plan_code
                || 'free'
            ),
            duration_mode: resolvePlanTermMode(responseProfile?.plan_code, responseProfile?.expiry_date),
            custom_expiry_date: responseProfile?.expiry_date ? String(responseProfile.expiry_date).slice(0, 16) : '',
            kill_switch_enabled: payload?.user?.kill_switch_enabled !== false
        };
    };

    const buildTrackedSnapshot = (patch: any, termMode: 'monthly' | 'yearly' | 'custom') => ({
        plan_code: toComparableValue(patch?.plan_code || 'free'),
        duration_mode: termMode,
        custom_expiry_date: termMode === 'custom' ? toComparableValue(patch?.custom_expiry_date || '') : '',
        instagram_connections_limit: toComparableValue(patch?.instagram_connections_limit),
        hourly_action_limit: toComparableValue(patch?.hourly_action_limit),
        daily_action_limit: toComparableValue(patch?.daily_action_limit),
        monthly_action_limit: toComparableValue(patch?.monthly_action_limit),
        no_watermark: patch?.no_watermark === true
    });

    const mergeDetailData = (payload: any) => {
        setDetailData((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                ...(payload || {}),
                user: payload?.user || prev.user,
                profile: payload?.profile || prev.profile,
                instagram_accounts: Array.isArray(payload?.instagram_accounts) ? payload.instagram_accounts : prev.instagram_accounts,
                total_linked_accounts: payload?.total_linked_accounts ?? prev.total_linked_accounts,
                max_allowed_accounts: payload?.max_allowed_accounts ?? prev.max_allowed_accounts,
                active_account_limit: payload?.active_account_limit ?? prev.active_account_limit,
                effective_limits: payload?.effective_limits || prev.effective_limits,
                effective_plan: payload?.effective_plan || prev.effective_plan,
                subscription_summary: payload?.subscription_summary || prev.subscription_summary
            };
        });
    };

    const handlePlanSelect = (nextPlanCode: string) => {
        const defaults = getPlanDefaults(nextPlanCode);
        setProfilePatch((prev: any) => ({
            ...prev,
            plan_code: resolvePlanOptionValue(nextPlanCode),
            instagram_connections_limit: defaults?.instagram_connections_limit ?? prev.instagram_connections_limit,
            hourly_action_limit: defaults?.hourly_action_limit ?? prev.hourly_action_limit,
            daily_action_limit: defaults?.daily_action_limit ?? prev.daily_action_limit,
            monthly_action_limit: defaults?.monthly_action_limit ?? prev.monthly_action_limit,
            no_watermark: defaults?.no_watermark ?? prev.no_watermark
        }));
    };

    const handleLimitChange = (key: LimitField, value: string) => {
        setProfilePatch((prev: any) => ({ ...prev, [key]: value }));
    };

    const restoreDefaultLimits = async () => {
        const defaults = getPlanDefaults(profilePatch.plan_code || 'free');
        if (!defaults) {
            setErrorMessage('Selected plan defaults are not available.');
            return;
        }
        setResetActionLoading('restoreLimits');
        setProfilePatch((prev: any) => ({
            ...prev,
            ...defaults
        }));
        setNotice('Default limits restored for selected plan.');
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        setResetActionLoading(null);
    };

    const submitPlanAndLimits = async () => {
        if (!selectedUser) return;
        const rollbackPatch = { ...profilePatch };
        const rollbackTermMode = planTermMode;
        setSaving(true);
        setErrorMessage(null);
        try {
            const payload = { ...profilePatch, action: 'change_assigned_plan' } as Record<string, any>;
            payload.duration_mode = planTermMode;
            payload.custom_expiry_date = planTermMode === 'custom' ? (profilePatch.custom_expiry_date || '') : '';
            delete payload.plan_source;
            payload.no_watermark = payload.no_watermark === true;
            payload.plan_code = resolvePlanOptionValue(payload.plan_code || profilePatch.plan_code || 'free');

            const response = await httpClient.patch(`/api/admin/users/${selectedUser.$id}/profile`, payload);
            const result = response.data?.data || {};
            mergeDetailData(result);
            if (result?.user?.ban_mode) {
                setBanMode(String(result.user.ban_mode || 'none') as 'none' | 'soft' | 'hard');
                setBanReason(String(result.user.ban_reason || ''));
            }
            const syncedPatch = buildSyncedProfilePatch(result);
            const syncedTermMode = resolvePlanTermMode(syncedPatch.plan_code, result?.profile?.expiry_date || null);
            setProfilePatch(syncedPatch);
            setLastSyncedProfilePatch(buildTrackedSnapshot(syncedPatch, syncedTermMode));
            setPlanTermMode(syncedTermMode);
            setUsers((prev) => prev.map((entry) => entry.$id === selectedUser.$id ? {
                ...entry,
                ban_mode: result?.user?.ban_mode ?? entry.ban_mode,
                ban_reason: result?.user?.ban_reason ?? entry.ban_reason,
                linked_instagram_accounts: Number(result?.total_linked_accounts ?? entry.linked_instagram_accounts ?? 0)
            } : entry));
            setNotice('Admin entitlement override updated.');
        } catch (error: any) {
            console.error('Failed to update plan and limits:', error);
            setProfilePatch(rollbackPatch);
            setPlanTermMode(rollbackTermMode);
            setErrorMessage(error?.response?.data?.error || 'Failed to save plan and limits.');
        } finally {
            setSaving(false);
        }
    };

    const resetToDefaultPlan = async () => {
        if (!selectedUser) return;
        setResetActionLoading('resetPlan');
        setSaving(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.post(`/api/admin/users/${selectedUser.$id}/reset-plan`, { action: 'reset_to_paid_snapshot_or_free' });
            const result = response.data?.data || {};
            if (result?.profile || result?.effective_limits) {
                mergeDetailData(result);
                const syncedPatch = buildSyncedProfilePatch(result);
                const syncedTermMode = resolvePlanTermMode(syncedPatch.plan_code, result?.profile?.expiry_date || null);
                setProfilePatch(syncedPatch);
                setPlanTermMode(syncedTermMode);
                setLastSyncedProfilePatch(buildTrackedSnapshot(syncedPatch, syncedTermMode));
                setUsers((prev) => prev.map((entry) => entry.$id === selectedUser.$id ? {
                    ...entry,
                    linked_instagram_accounts: Number(result?.total_linked_accounts ?? entry.linked_instagram_accounts ?? 0),
                    profile: result?.profile || entry.profile
                } : entry));
            }
            setNotice('Default plan restored from latest valid payment or free.');
        } catch (error: any) {
            console.error('Failed to reset plan:', error);
            setErrorMessage(error?.response?.data?.error || 'Failed to reset plan.');
        } finally {
            setResetActionLoading(null);
            setSaving(false);
        }
    };

    const saveBan = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setErrorMessage(null);
        try {
            const response = await httpClient.post(`/api/admin/users/${selectedUser.$id}/ban`, {
                mode: banMode,
                reason: banReason,
                kill_switch_enabled: profilePatch.kill_switch_enabled !== false
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

    const trackedSnapshot = useMemo(() => buildTrackedSnapshot(profilePatch, planTermMode), [profilePatch, planTermMode]);
    const hasPlanLimitChanges = useMemo(() => {
        if (!lastSyncedProfilePatch) return false;
        return Object.keys(trackedSnapshot).some((key) => trackedSnapshot[key as keyof typeof trackedSnapshot] !== lastSyncedProfilePatch[key as keyof typeof lastSyncedProfilePatch]);
    }, [lastSyncedProfilePatch, trackedSnapshot]);
    const isSaveDisabled = saving || isDeletingUser || !hasPlanLimitChanges;

    if (!hasLoadedUsersOnce && loading) {
        return <AdminLoadingState title="Loading users" description="Preparing user records, subscription details, and moderation controls." />;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <p className="text-[10px] font-black text-muted-foreground">Users</p>
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

            {!userId && (notice || errorMessage) && (
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
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground">User</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground">Plan</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground">IG Accounts</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground">Ban</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-muted-foreground">Action</th>
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
                                            {user.profile?.plan_code || 'free'}
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
                        <section className={`${surfaceClass} custom-scrollbar relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6`}>
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
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    {[
                                        ['Effective Plan', detailData?.effective_plan?.name || 'Free'],
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
                                        onClick={() => togglePopupSection('planSettings')}
                                        className="flex w-full items-start justify-between gap-3 text-left"
                                    >
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Plan & limits</h3>
                                            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                Choose a plan, review the plan defaults instantly, adjust limits if needed, and save everything together.
                                            </p>
                                        </div>
                                        {popupSections.planSettings ? <ChevronUp className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    {popupSections.planSettings ? <div className="mt-5 space-y-4">
                                        <div className="rounded-[24px] border border-border/70 bg-gradient-to-br from-background/95 to-muted/20 p-4 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.45)] sm:p-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-foreground">Plan</h4>
                                                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                        Assigning a plan here replaces the user&apos;s active entitlement until expiry, reset, or a newer successful payment.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => void resetToDefaultPlan()}
                                                    className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-[10px] sm:w-auto sm:min-w-[14rem] disabled:opacity-60"
                                                    disabled={saving || isDeletingUser || resetActionLoading === 'restoreLimits'}
                                                >
                                                    {resetActionLoading === 'resetPlan' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                    {resetActionLoading === 'resetPlan' ? 'Resetting Plan...' : 'Reset to Default Plan'}
                                                </button>
                                            </div>

                                            <div className="mt-4 space-y-4">
                                                <SelectField
                                                    label="Assigned plan"
                                                    hint="Changing the plan immediately loads that plan's default limits in the limits section below."
                                                    value={selectedPlanCode || 'free'}
                                                    onChange={handlePlanSelect}
                                                >
                                                    <option value="free">Free Plan</option>
                                                    {pricingPlans
                                                        .filter((plan) => normalizePlanIdentifier(plan.plan_code || plan.id) !== 'free')
                                                        .map((plan) => (
                                                            <option key={plan.id} value={resolvePlanOptionValue(plan.plan_code || plan.id)}>{plan.name}</option>
                                                        ))}
                                                </SelectField>

                                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)]">
                                                    <div className={popupInsetClass}>
                                                        <p className="text-xs font-semibold text-muted-foreground">Derived subscription state</p>
                                                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                                                            Plan code: {detailData?.subscription_summary?.plan_code || detailData?.profile?.plan_code || 'free'}
                                                        </p>
                                                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                            <div className="rounded-[18px] border border-border/70 bg-card/80 px-4 py-3">
                                                                <p className="text-[10px] font-black text-muted-foreground">Source</p>
                                                                <p className="mt-2 text-sm font-bold text-foreground">{detailData?.subscription_summary?.plan_source || detailData?.plan_source || 'system'}</p>
                                                            </div>
                                                            <div className="rounded-[18px] border border-border/70 bg-card/80 px-4 py-3">
                                                                <p className="text-[10px] font-black text-muted-foreground">Status</p>
                                                                <p className="mt-2 text-sm font-bold text-foreground">{detailData?.subscription_summary?.derived_status || detailData?.derived_status || 'inactive'}</p>
                                                            </div>
                                                            <div className="rounded-[18px] border border-border/70 bg-card/80 px-4 py-3">
                                                                <p className="text-[10px] font-black text-muted-foreground">Expiry</p>
                                                                <p className="mt-2 text-sm font-bold text-foreground">
                                                                    {formatExpiryLabel(detailData?.subscription_summary?.expiry_date || detailData?.expiry_date || null)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {freePlanModeLabel ? <p className="mt-3 text-xs font-semibold text-muted-foreground">{freePlanModeLabel}</p> : null}
                                                    </div>

                                                    <div className={popupInsetClass}>
                                                        <p className="text-xs font-semibold text-muted-foreground">Source</p>
                                                        <p className="mt-2 text-sm font-bold text-foreground">
                                                            {String(detailData?.subscription_summary?.plan_source || detailData?.plan_source || 'system').replace(/^./, (char: string) => char.toUpperCase())}
                                                        </p>
                                                        <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                            Read-only. Subscription source is controlled by the backend.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className={popupInsetClass}>
                                                    <p className="text-xs font-semibold text-muted-foreground">Plan term</p>
                                                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                        Choose monthly, yearly, or a custom expiry date.
                                                        {selectedPlanCode === 'free' ? ' Leave the custom date blank to keep the user on Permanent Free.' : ''}
                                                    </p>
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
                                            </div>
                                        </div>

                                        <div className="rounded-[24px] border border-border/70 bg-gradient-to-br from-background/95 to-muted/20 p-4 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.45)] sm:p-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-foreground">Limits</h4>
                                                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                                        Adjust account capacity, action limits, and watermark behavior independently from plan selection.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => void restoreDefaultLimits()}
                                                    className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-[10px] sm:w-auto sm:min-w-[14rem] disabled:opacity-60"
                                                    disabled={saving || isDeletingUser || resetActionLoading === 'resetPlan'}
                                                >
                                                    {resetActionLoading === 'restoreLimits' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                    {resetActionLoading === 'restoreLimits' ? 'Restoring Limits...' : 'Restore Default Limits'}
                                                </button>
                                            </div>

                                            <div className="mt-4 space-y-4">
                                                <div className={`${popupInsetClass} text-xs text-muted-foreground`}>
                                                    <p>Active account limit: <span className="font-semibold text-foreground">{detailData?.active_account_limit ?? detailData?.effective_limits?.active_account_limit ?? 0}</span></p>
                                                    {(detailData?.max_allowed_accounts ?? 0) !== (detailData?.active_account_limit ?? detailData?.effective_limits?.active_account_limit ?? 0) ? (
                                                        <p className="mt-1">Current linked capacity: {detailData?.max_allowed_accounts ?? 0} linked accounts.</p>
                                                    ) : null}
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    {[
                                                        ['instagram_connections_limit', 'Plan active limit'],
                                                        ['hourly_action_limit', 'Hourly actions'],
                                                        ['daily_action_limit', 'Daily actions'],
                                                        ['monthly_action_limit', 'Monthly actions']
                                                    ].map(([key, label]) => (
                                                        <div key={key}>
                                                            <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                                                            <input
                                                                className="input-base mt-2"
                                                                value={profilePatch[key] ?? ''}
                                                                onChange={(event) => handleLimitChange(key as LimitField, event.target.value)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className={popupInsetClass}>
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
                                            </div>
                                        </div>

                                        <div className="flex justify-stretch sm:justify-end">
                                            <button onClick={() => void submitPlanAndLimits()} className="btn-primary w-full px-4 py-3 text-[10px] sm:w-auto sm:min-w-[14rem] disabled:opacity-60" disabled={isSaveDisabled}>
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                Save Plan & Limits
                                            </button>
                                        </div>
                                    </div> : null}
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
                                            return (
                                                <div key={acc.$id} className="flex flex-col gap-3 rounded-[22px] border border-border/70 bg-background/72 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.45)] sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-foreground">{acc.username || acc.ig_user_id || acc.account_id}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {accessLabel}
                                                            {acc.plan_locked === true && isAdminActive && isUserActive ? ' - over plan active-account limit' : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
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
                                        <input
                                            className="input-base"
                                            placeholder="Ban reason"
                                            value={banReason}
                                            onChange={(event) => setBanReason(event.target.value)}
                                        />
                                        <div className={popupInsetClass}>
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
                                        <div className="mt-4 border-t border-border/70 pt-4">
                                            <button
                                                onClick={() => {
                                                    setDeleteConfirmText('');
                                                    setShowDeleteUserDialog(true);
                                                }}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-[10px] font-black text-destructive disabled:opacity-60"
                                                disabled={saving || isDeletingUser}
                                            >
                                                {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                Delete User
                                            </button>
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
                        <p>This will apply the selected ban mode and kill-switch state immediately.</p>
                        <p className="font-semibold text-foreground">Mode: {banMode} | Kill switch: {profilePatch.kill_switch_enabled === false ? 'Disabled' : 'Enabled'}</p>
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
