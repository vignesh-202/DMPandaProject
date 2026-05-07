import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildLockedFeatureState, getFeatureLabel, hasPlanEntitlement, normalizeFeatureKey } from '../lib/planAccess';
import { findPricingPlan, normalizePricingPayload, type PricingPlan } from '../lib/pricing';

export type ViewType =
    | 'Overview'
    | 'Analytics'
    | 'Insights'
    | 'Reply Templates'
    | 'Super Profile'
    | 'Inbox Menu'
    | 'Welcome Message'
    | 'Convo Starter'
    | 'Global Trigger'
    | 'DM Automation'
    | 'Post Automation'
    | 'Reel Automation'
    | 'Story Automation'
    | 'Live Automation'
    | 'Mentions'
    | 'Email Collector'
    | 'Suggest More'
    | 'Transactions'
    | 'My Plan'
    | 'Account Settings'
    | 'Support'
    | 'Pricing'
    | 'Watch Video'
    | 'Contact'
    | 'Have feedback?'
    | 'Comment Automation'
    | 'Share Automation'
    | 'Mention Automation'
    | 'Comment Moderation'
    | 'Automation Not working?';

interface DashboardContextProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    mediaCache: Record<string, any[]>;
    updateMediaCache: (type: string, items: any[]) => void;
    // Navigation Protection
    hasUnsavedChanges: boolean;
    setHasUnsavedChanges: (value: boolean) => void;
    saveUnsavedChanges: () => Promise<boolean>;
    setSaveUnsavedChanges: React.Dispatch<React.SetStateAction<() => Promise<boolean>>>;
    discardUnsavedChanges: () => void;
    setDiscardUnsavedChanges: React.Dispatch<React.SetStateAction<() => void>>;
    // Accounts
    igAccounts: any[];
    setIgAccounts: React.Dispatch<React.SetStateAction<any[]>>;
    fetchIgAccounts: () => Promise<void>;
    isLoadingAccounts: boolean;
    setIsLoadingAccounts: (loading: boolean) => void;
    isInitialLoadComplete: boolean;
    activeAccountID: string | null;
    setActiveAccountID: (id: string | null) => void;
    activeAccount: any | null;
    activeAccountStats: any | null;
    isLoadingStats: boolean;
    refreshStats: () => void;
    analyticsCache: Record<string, any>; // Key: accountId_start_end_category
    setAnalyticsCache: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    analyticsLoading: {
        overview: boolean;
        audience: boolean;
        activity: boolean;
    };
    setAnalyticsLoading: React.Dispatch<React.SetStateAction<{
        overview: boolean;
        audience: boolean;
        activity: boolean;
    }>>;
    analyticsDateRange: {
        start: string;
        end: string;
    };
    setAnalyticsDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
    dmAutomations: any[];
    setDmAutomations: React.Dispatch<React.SetStateAction<any[]>>;
    automationInitialLoaded: Record<string, boolean>;
    setAutomationInitialLoaded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    globalTriggers: any[];
    setGlobalTriggers: React.Dispatch<React.SetStateAction<any[]>>;

    convoStarters: any[];
    setConvoStarters: React.Dispatch<React.SetStateAction<any[]>>;
    convoStarterData: any | null;
    setConvoStarterData: React.Dispatch<React.SetStateAction<any | null>>;
    fetchConvoStarters: (force?: boolean) => Promise<void>;
    convoStarterLoading: boolean;
    inboxMenuData: any | null;
    setInboxMenuData: React.Dispatch<React.SetStateAction<any | null>>;
    fetchInboxMenu: (force?: boolean) => Promise<void>;
    inboxMenuLoading: boolean;
    isGlobalLoading: boolean;
    fetchAutomations: (force?: boolean) => Promise<void>;
    planFeatures: string[];
    planEntitlements: Record<string, boolean>;
    planLimits: {
        instagram_connections_limit?: number | null;
        instagram_link_limit?: number | null;
        hourly_action_limit?: number | null;
        daily_action_limit?: number | null;
        monthly_action_limit?: number | null;
    };
    planPureLimits: {
        max_link_limit: number | null;
        active_account_limit: number;
    };
    accessState: {
        ban_mode?: string;
        ban_message?: string | null;
        automation_locked?: boolean;
        automation_lock_reason?: string | null;
        kill_switch_enabled?: boolean;
        dashboard_allowed?: boolean;
        is_soft_banned?: boolean;
    } | null;
    refreshPlanAccess: () => Promise<void>;
    refreshLinkedProfiles: () => Promise<void>;
    hasPlanFeature: (featureKey: string) => boolean;
    getPlanGate: (featureKey: string, note?: string) => {
        isLocked: boolean;
        featureKey: string;
        label: string;
        note: string;
    };
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

const DASHBOARD_BASE_PATH = '/dashboard';

const VIEW_PATHS: Record<ViewType, string> = {
    'Overview': '',
    'Analytics': 'analytics',
    'Insights': 'insights',
    'Reply Templates': 'reply-templates',
    'Super Profile': 'super-profile',
    'Inbox Menu': 'inbox-menu',
    'Welcome Message': 'welcome-message',
    'Convo Starter': 'convo-starter',
    'Global Trigger': 'global-triggers',
    'DM Automation': 'dm-automation',
    'Post Automation': 'post-automation',
    'Reel Automation': 'reel-automation',
    'Story Automation': 'story-automation',
    'Live Automation': 'live-automation',
    'Mentions': 'mentions',
    'Email Collector': 'email-collector',
    'Suggest More': 'suggest-more',
    'Transactions': 'transactions',
    'My Plan': 'my-plan',
    'Account Settings': 'account-settings',
    'Support': 'support',
    'Pricing': 'pricing',
    'Watch Video': 'watch-video',
    'Contact': 'contact',
    'Have feedback?': 'feedback',
    'Comment Automation': 'comment-automation',
    'Share Automation': 'share-automation',
    'Mention Automation': 'mention-automation',
    'Comment Moderation': 'comment-moderation',
    'Automation Not working?': 'automation-not-working'
};

const PATH_ALIASES: Record<string, string> = {
    'global-trigger': 'global-triggers'
};

const PATH_TO_VIEW = Object.entries(VIEW_PATHS).reduce<Record<string, ViewType>>((acc, [view, path]) => {
    acc[path] = view as ViewType;
    return acc;
}, {});

const normalizeDashboardPathname = (pathname: string): string => {
    const normalized = pathname.replace(/\/+$/, '');
    return normalized || DASHBOARD_BASE_PATH;
};

const getViewFromPathname = (pathname: string): ViewType => {
    const normalized = normalizeDashboardPathname(pathname);
    if (!normalized.startsWith(DASHBOARD_BASE_PATH)) return 'Overview';
    const suffix = normalized.slice(DASHBOARD_BASE_PATH.length).replace(/^\/+/, '');
    
    const resolvedSuffix = PATH_ALIASES[suffix] || suffix;

    // Exact match
    if (PATH_TO_VIEW[resolvedSuffix]) {
        return PATH_TO_VIEW[resolvedSuffix];
    }
    
    // Subpath match
    const segments = resolvedSuffix.split('/');
    const firstSegment = segments[0] || '';
    const resolvedFirstSegment = PATH_ALIASES[firstSegment] || firstSegment;
    if (segments.length > 0 && PATH_TO_VIEW[resolvedFirstSegment]) {
        return PATH_TO_VIEW[resolvedFirstSegment];
    }

    return PATH_TO_VIEW[resolvedSuffix] || 'Overview';
};

const getPathForView = (view: ViewType): string => {
    const suffix = VIEW_PATHS[view] || '';
    return suffix ? `${DASHBOARD_BASE_PATH}/${suffix}` : DASHBOARD_BASE_PATH;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
    const { user, accessState: authAccessState } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [currentViewState, setCurrentViewState] = useState<ViewType>(() => getViewFromPathname(location.pathname));
    const [mediaCache, setMediaCache] = useState<Record<string, any[]>>({});
    const [igAccounts, setIgAccounts] = useState<any[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [activeAccountID, setActiveAccountID] = useState<string | null>(null);
    const [activeAccountStats, setActiveAccountStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [analyticsCache, setAnalyticsCache] = useState<Record<string, any>>({});
    const [analyticsLoading, setAnalyticsLoading] = useState<{
        overview: boolean;
        audience: boolean;
        activity: boolean;
    }>({
        overview: false,
        audience: false,
        activity: false
    });
    const [analyticsDateRange, setAnalyticsDateRange] = useState<{ start: string; end: string }>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [dmAutomations, setDmAutomations] = useState<any[]>([]);
    const [globalTriggers, setGlobalTriggers] = useState<any[]>([]);

    const [convoStarters, setConvoStarters] = useState<any[]>([]);
    const [convoStarterData, setConvoStarterData] = useState<any | null>(null);
    const [convoStarterLoading, setConvoStarterLoading] = useState(false);
    const isFetchingConvoStarters = useRef(false);
    const convoStartersFetchPromise = useRef<Promise<void> | null>(null);
    const [inboxMenuData, setInboxMenuData] = useState<any | null>(null);
    const [inboxMenuLoading, setInboxMenuLoading] = useState(false);
    const [automationInitialLoaded, setAutomationInitialLoaded] = useState<Record<string, boolean>>({});
    const isFetchingInboxMenu = useRef(false);
    const [planFeatures, setPlanFeatures] = useState<string[]>([]);
    const [planEntitlements, setPlanEntitlements] = useState<Record<string, boolean>>({});
    const [planLimits, setPlanLimits] = useState<DashboardContextProps['planLimits']>({});
    const [planPureLimits, setPlanPureLimits] = useState<DashboardContextProps['planPureLimits']>({
        max_link_limit: null,
        active_account_limit: 0
    });
    const [currentPlanIdentifier, setCurrentPlanIdentifier] = useState<string>('free');
    const [accessState, setAccessState] = useState<DashboardContextProps['accessState']>(authAccessState || null);

    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    const { authenticatedFetch } = useAuth();
    const pricingPlansRef = useRef<PricingPlan[]>([]);
    const currentPlanIdentifierRef = useRef<string>('free');

    useEffect(() => {
        currentPlanIdentifierRef.current = currentPlanIdentifier;
    }, [currentPlanIdentifier]);

    const resolveActiveAccountLimit = useCallback((limitsPayload: any): number => {
        const value = Number(limitsPayload?.active_account_limit ?? limitsPayload?.instagram_connections_limit ?? 0);
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, value);
    }, []);

    const applyPlanPureLimits = useCallback((plans: PricingPlan[], planIdentifier: string) => {
        const normalizedPlans = Array.isArray(plans) ? plans : [];
        const explicitLinkLimits = normalizedPlans
            .map((plan) => Number(plan.instagram_link_limit))
            .filter((value) => Number.isFinite(value) && value >= 0);
        const fallbackConnectionLimits = normalizedPlans
            .map((plan) => Number(plan.instagram_connections_limit))
            .filter((value) => Number.isFinite(value) && value >= 0);
        const maxLinkLimit = explicitLinkLimits.length > 0
            ? Math.max(...explicitLinkLimits)
            : (fallbackConnectionLimits.length > 0 ? Math.max(...fallbackConnectionLimits) : null);
        const activePlan = findPricingPlan(normalizedPlans, planIdentifier);
        if (!activePlan) {
            // Keep identifier resolution as a no-op dependency until pricing/plan fetches settle.
        }

        setPlanPureLimits((previous) => ({
            ...previous,
            max_link_limit: maxLinkLimit == null ? null : Math.max(0, maxLinkLimit)
        }));
    }, []);

    const refreshPricingPlanCatalog = useCallback(async () => {
        const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/pricing`);
        if (!response.ok) {
            throw new Error('Failed to load pricing plans');
        }
        const payload = await response.json();
        const plans = normalizePricingPayload(payload);
        pricingPlansRef.current = plans;
        applyPlanPureLimits(plans, currentPlanIdentifierRef.current);
    }, [applyPlanPureLimits, authenticatedFetch]);

    const hasPlanFeature = useCallback((featureKey: string) => {
        if (hasPlanEntitlement(planEntitlements, featureKey)) return true;

        const normalizedFeatureLabel = normalizeFeatureKey(getFeatureLabel(featureKey)).replace(/_/g, ' ');
        return planFeatures
            .map((feature) => normalizeFeatureKey(String(feature || '')).replace(/_/g, ' '))
            .filter(Boolean)
            .some((feature) => feature === normalizedFeatureLabel || feature.includes(normalizedFeatureLabel));
    }, [planEntitlements, planFeatures]);

    const getPlanGate = useCallback((featureKey: string, note?: string) => {
        const gate = buildLockedFeatureState(planEntitlements, featureKey, note);
        return {
            ...gate,
            isLocked: !hasPlanFeature(gate.featureKey)
        };
    }, [planEntitlements, planFeatures]);

    const setCurrentView = useCallback((view: ViewType) => {
        const nextPath = getPathForView(view);
        if (normalizeDashboardPathname(location.pathname) === normalizeDashboardPathname(nextPath)) {
            return;
        }
        navigate(nextPath);
    }, [location.pathname, navigate]);

    useEffect(() => {
        const routeView = getViewFromPathname(location.pathname);
        const canonicalPath = getPathForView(routeView);
        const normalizedPath = normalizeDashboardPathname(location.pathname);

        setCurrentViewState((prev) => (prev === routeView ? prev : routeView));

        if (normalizedPath.startsWith(DASHBOARD_BASE_PATH)) {
            const isSubpath = canonicalPath !== DASHBOARD_BASE_PATH && normalizedPath.startsWith(`${canonicalPath}/`);
            if (normalizedPath !== canonicalPath && !isSubpath) {
                navigate(canonicalPath, { replace: true });
            }
        }
    }, [location.pathname, navigate]);

    const refreshPlanAccess = useCallback(async () => {
        const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`);
        if (!response.ok) {
            throw new Error('Failed to load plan access');
        }
        const payload = await response.json();
        const planIdentifier = String(payload?.plan_code || payload?.plan_id || payload?.assigned_plan_id || 'free').trim().toLowerCase() || 'free';
        if (pricingPlansRef.current.length === 0) {
            await refreshPricingPlanCatalog().catch(() => null);
        }
        const limitsPayload = payload?.limits && typeof payload.limits === 'object' ? payload.limits : {};
        setPlanFeatures(Array.isArray(payload?.details?.features) ? payload.details.features : []);
        setPlanEntitlements(payload?.entitlements && typeof payload.entitlements === 'object' ? payload.entitlements : {});
        setPlanLimits(limitsPayload);
        setPlanPureLimits((previous) => ({
            ...previous,
            active_account_limit: resolveActiveAccountLimit(limitsPayload)
        }));
        setCurrentPlanIdentifier(planIdentifier);
        applyPlanPureLimits(pricingPlansRef.current, planIdentifier);
        setAccessState(payload?.access_state || authAccessState || null);
    }, [applyPlanPureLimits, authAccessState, authenticatedFetch, refreshPricingPlanCatalog, resolveActiveAccountLimit]);

    useEffect(() => {
        let cancelled = false;
        const loadPlanFeatures = async () => {
            try {
                const [planResponse] = await Promise.all([
                    authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`),
                    pricingPlansRef.current.length === 0 ? refreshPricingPlanCatalog().catch(() => null) : Promise.resolve()
                ]);
                if (!planResponse.ok) {
                    throw new Error('Failed to load plan access');
                }
                const payload = await planResponse.json();
                const planIdentifier = String(payload?.plan_code || payload?.plan_id || payload?.assigned_plan_id || 'free').trim().toLowerCase() || 'free';
                if (!cancelled) {
                    const limitsPayload = payload?.limits && typeof payload.limits === 'object' ? payload.limits : {};
                    setPlanFeatures(Array.isArray(payload?.details?.features) ? payload.details.features : []);
                    setPlanEntitlements(payload?.entitlements && typeof payload.entitlements === 'object' ? payload.entitlements : {});
                    setPlanLimits(limitsPayload);
                    setPlanPureLimits((previous) => ({
                        ...previous,
                        active_account_limit: resolveActiveAccountLimit(limitsPayload)
                    }));
                    setCurrentPlanIdentifier(planIdentifier);
                    applyPlanPureLimits(pricingPlansRef.current, planIdentifier);
                    setAccessState(payload?.access_state || authAccessState || null);
                }
            } catch (_) {
                if (!cancelled) {
                    setPlanFeatures([]);
                    setPlanEntitlements({});
                    setPlanLimits({});
                    setPlanPureLimits((previous) => ({
                        ...previous,
                        active_account_limit: 0
                    }));
                    setCurrentPlanIdentifier('free');
                    applyPlanPureLimits(pricingPlansRef.current, 'free');
                    setAccessState(authAccessState || null);
                }
            }
        };
        loadPlanFeatures();
        return () => {
            cancelled = true;
        };
    }, [applyPlanPureLimits, authAccessState, authenticatedFetch, refreshPricingPlanCatalog, resolveActiveAccountLimit, user?.$id]);

    useEffect(() => {
        setAccessState((prev) => authAccessState || prev || null);
    }, [authAccessState]);

    // Refs for stable dependencies in callbacks
    const igAccountsRef = React.useRef(igAccounts);
    const automationInitialLoadedRef = React.useRef(automationInitialLoaded);

    React.useEffect(() => {
        igAccountsRef.current = igAccounts;
    }, [igAccounts]);

    React.useEffect(() => {
        automationInitialLoadedRef.current = automationInitialLoaded;
    }, [automationInitialLoaded]);

    // Ref to track the last account ID for which stats were fetched to prevent duplicates
    const lastFetchedStatsAccountID = React.useRef<string | null>(null);

    const bulkProfileRefreshKeys = React.useRef<Set<string>>(new Set());

    const refreshLinkedProfiles = useCallback(async () => {
        const sourceAccounts = igAccountsRef.current || [];
        const refreshKey = sourceAccounts
            .map((account) => `${account.id}:${account.profile_picture_url || ''}:${account.username || ''}`)
            .join('|');
        if (!refreshKey) return;
        if (bulkProfileRefreshKeys.current.has(refreshKey)) return;
        bulkProfileRefreshKeys.current.add(refreshKey);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts/refresh-profiles`, {
                method: 'POST'
            });
            if (!response.ok) return;
            const payload = await response.json().catch(() => null);
            if (Array.isArray(payload?.ig_accounts)) {
                setIgAccounts(payload.ig_accounts);
            }
        } catch (_) {
            // best effort
        } finally {
            bulkProfileRefreshKeys.current.delete(refreshKey);
        }
    }, [authenticatedFetch]);

    // Fetch account stats
    const fetchStats = useCallback(async (accountId: string, accountsOverride?: any[]) => {
        const sourceAccounts = accountsOverride || igAccountsRef.current;
        const account = sourceAccounts.find(a => a.ig_user_id === accountId || a.id === accountId);
        if (!account) {
            setActiveAccountStats(null);
            return;
        }

        // Avoid re-fetching if we just fetched for this account (optional, but good for avoiding rapid duplicate calls from different sources)
        // But we must allow force refreshes if needed. For now, we rely on the useEffect check.

        lastFetchedStatsAccountID.current = accountId;
        setIsLoadingStats(true);
        setActiveAccountStats(null); // Clear old stats immediately to prevent lag/flash of old data
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/stats?account_id=${accountId}`);
            if (response.ok) {
                const data = await response.json();
                setActiveAccountStats({ ...data, _accountId: accountId });
            } else {
                setActiveAccountStats(null);
            }
        } catch (error) {
            console.error('Error fetching account stats:', error);
            setActiveAccountStats(null);
        } finally {
            setIsLoadingStats(false);
        }
    }, [authenticatedFetch]);

    const isFetchingAccounts = useRef(false);
    const planRevalidationInFlight = useRef(false);

    // Unified accounts fetch with automatic sync
    const fetchIgAccounts = useCallback(async () => {
        if (isFetchingAccounts.current) return;
        isFetchingAccounts.current = true;

        setIsLoadingAccounts(true);
        // Ensure global loading is true on start if needed, but usually it's true by default on mount
        // setIsGlobalLoading(true); 

        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts`);
            if (response.ok) {
                const data = await response.json();
                const accounts = data.ig_accounts || [];
                setIgAccounts(accounts);
                if (accounts.length > 0) {
                    void refreshLinkedProfiles();
                }

                if (accounts.length > 0) {
                    // Logic to determine ID for initial load
                    let initialTargetID: string | null = null;

                    const firstActive = accounts.find((a: any) => a.status === 'active' && a.effective_access !== false);
                    if (firstActive) {
                        initialTargetID = firstActive.ig_user_id;
                    } else {
                        initialTargetID = accounts[0].ig_user_id;
                    }

                    // Update state carefully
                    setActiveAccountID(prevID => {
                        // If we already have a valid ID in state that exists in the new list, keep it
                        if (prevID && accounts.find((a: any) => (a.ig_user_id === prevID || a.id === prevID))) {
                            return prevID;
                        }
                        return initialTargetID;
                    });

                    // Start stats early, but do not block the first dashboard paint on it.
                    if (initialTargetID) {
                        const targetAcc = accounts.find((a: any) => a.ig_user_id === initialTargetID || a.id === initialTargetID);
                        if (targetAcc) {
                            lastFetchedStatsAccountID.current = initialTargetID;
                            void fetchStats(initialTargetID, accounts);
                        }
                    }
                } else {
                    setActiveAccountID(null);
                    setActiveAccountStats(null);
                }
            }
        } catch (error) {
            console.error('Error fetching IG accounts:', error);
        } finally {
            setIsLoadingAccounts(false);
            setIsInitialLoadComplete(true);
            setIsGlobalLoading(false);
            isFetchingAccounts.current = false;
        }
    }, [authenticatedFetch, fetchStats, refreshLinkedProfiles]);

    // Initial load
    useEffect(() => {
        if (user) {
            void fetchIgAccounts();
        }
    }, [user?.$id, fetchIgAccounts]);

    useEffect(() => {
        if (!user || !isInitialLoadComplete) return;

        const revalidate = async () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                return;
            }
            if (planRevalidationInFlight.current) {
                return;
            }
            planRevalidationInFlight.current = true;
            try {
                await refreshPlanAccess();
                const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts`);
                if (!response.ok) return;
                const payload = await response.json().catch(() => null);
                if (Array.isArray(payload?.ig_accounts)) {
                    setIgAccounts(payload.ig_accounts);
                    setActiveAccountID((prevID) => {
                        if (prevID && payload.ig_accounts.some((account: any) => account.ig_user_id === prevID || account.id === prevID)) {
                            return prevID;
                        }
                        const firstAccessible = payload.ig_accounts.find((account: any) => account.status === 'active' && account.effective_access !== false);
                        return firstAccessible?.ig_user_id || payload.ig_accounts[0]?.ig_user_id || null;
                    });
                }
            } catch (_) {
                // keep current session state until the next successful revalidation
            } finally {
                planRevalidationInFlight.current = false;
            }
        };

        const intervalId = window.setInterval(revalidate, 20000);
        const handleVisibilityOrFocus = () => {
            void revalidate();
        };
        window.addEventListener('focus', handleVisibilityOrFocus);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleVisibilityOrFocus);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        };
    }, [authenticatedFetch, isInitialLoadComplete, refreshPlanAccess, user]);

    // Trigger stats fetch when active ID changes AFTER initial load
    // We use a ref to skip the first run because fetchIgAccounts handles it
    const isFirstRun = React.useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        if (activeAccountID && isInitialLoadComplete) {
            // Only fetch if different from last successfully fetched/attempted ID
            if (activeAccountID !== lastFetchedStatsAccountID.current) {
                fetchStats(activeAccountID);
            }
        } else if (!activeAccountID) {
            setActiveAccountStats(null);
            lastFetchedStatsAccountID.current = null;
        }
    }, [activeAccountID, fetchStats, isInitialLoadComplete]);

    // Clear caches when switching accounts to ensure no data bleed
    useEffect(() => {
        if (activeAccountID) {
            setDmAutomations([]);
            setGlobalTriggers([]);

            setConvoStarters([]);
            setConvoStarterData(null);
            setInboxMenuData(null);
            setAutomationInitialLoaded({});
            setMediaCache({}); // Clear media cache to force reloads for Reels, Posts, etc.
        }
    }, [activeAccountID]);

    const activeAccount = igAccounts.find(a => a.ig_user_id === activeAccountID || a.id === activeAccountID) || null;

    const fetchAutomations = useCallback(async (force = false) => {
        if (!activeAccountID) return;
        // If already loaded and not forced, skip
        if (automationInitialLoadedRef.current['dm'] && !force) return;

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}`);
            const data = await res.json();
            if (res.ok) {
                setDmAutomations(data.automations || []);
                setAutomationInitialLoaded(prev => ({ ...prev, dm: true }));
            }
        } catch (e) {
            console.error("Failed to fetch automations", e);
        }
    }, [activeAccountID, authenticatedFetch]);

    const fetchInboxMenu = useCallback(async (force = false) => {
        if (!activeAccountID) return;
        if (inboxMenuData && !force) return;
        if (isFetchingInboxMenu.current && !force) return;

        isFetchingInboxMenu.current = true;
        setInboxMenuLoading(true);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/inbox-menu?account_id=${activeAccountID}`);
            if (response.ok) {
                const data = await response.json();
                setInboxMenuData(data);
            }
        } catch (error) {
            console.error('Error fetching inbox menu:', error);
        } finally {
            isFetchingInboxMenu.current = false;
            setInboxMenuLoading(false);
        }
    }, [activeAccountID, authenticatedFetch, inboxMenuData]);

    const fetchConvoStarters = useCallback(async (force = false) => {
        if (!activeAccountID) return;
        if (convoStarterData && !force) return;
        if (isFetchingConvoStarters.current && !force) return;
        if (convoStartersFetchPromise.current && !force) {
            await convoStartersFetchPromise.current;
            return;
        }

        isFetchingConvoStarters.current = true;
        setConvoStarterLoading(true);
        const fetchPromise = (async () => {
            try {
                const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/convo-starters?account_id=${activeAccountID}`);
                if (response.ok) {
                    const data = await response.json();
                    setConvoStarterData(data);
                    if (data.db_starters && data.db_starters.length > 0) {
                        setConvoStarters(data.db_starters);
                    } else if (data.ig_starters && data.ig_starters.length > 0) {
                        setConvoStarters(data.ig_starters);
                    } else {
                        setConvoStarters([]);
                    }
                } else {
                    console.error('Failed to fetch convo starters:', response.status, response.statusText);
                    // Set empty data to prevent infinite loading
                    setConvoStarterData({ ig_starters: [], db_starters: [], is_synced: false, status: 'none', issue: 'API Error', account_id: activeAccountID });
                    setConvoStarters([]);
                }
            } catch (error) {
                console.error('Error fetching convo starters:', error);
                // Set empty data to prevent infinite loading
                setConvoStarterData({ ig_starters: [], db_starters: [], is_synced: false, status: 'none', issue: 'Network Error', account_id: activeAccountID });
                setConvoStarters([]);
            } finally {
                isFetchingConvoStarters.current = false;
                convoStartersFetchPromise.current = null;
                setConvoStarterLoading(false);
            }
        })();

        convoStartersFetchPromise.current = fetchPromise;
        await fetchPromise;
    }, [activeAccountID, authenticatedFetch, convoStarterData]);

    const updateMediaCache = (type: string, items: any[]) => {
        setMediaCache(prev => ({ ...prev, [type]: items }));
    };

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveUnsavedChanges, setSaveUnsavedChanges] = useState<() => Promise<boolean>>(() => async () => true);
    const [discardUnsavedChanges, setDiscardUnsavedChanges] = useState<() => void>(() => () => { });

    const value = {
        currentView: currentViewState,
        setCurrentView,
        mediaCache,
        updateMediaCache,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        saveUnsavedChanges,
        setSaveUnsavedChanges,
        discardUnsavedChanges,
        setDiscardUnsavedChanges,
        igAccounts,
        setIgAccounts,
        fetchIgAccounts,
        isLoadingAccounts: isLoadingAccounts,
        setIsLoadingAccounts,
        isInitialLoadComplete,
        activeAccountID,
        setActiveAccountID,
        activeAccount,
        activeAccountStats,
        isLoadingStats,
        refreshStats: () => {
            if (activeAccountID) {
                fetchStats(activeAccountID);
            }
        },
        analyticsCache,
        setAnalyticsCache,
        analyticsLoading,
        setAnalyticsLoading,
        analyticsDateRange,
        setAnalyticsDateRange,
        dmAutomations,
        setDmAutomations,
        fetchAutomations,
        globalTriggers,
        setGlobalTriggers,

        convoStarters,
        setConvoStarters,
        convoStarterData,
        setConvoStarterData,
        fetchConvoStarters,
        convoStarterLoading,
        inboxMenuData,
        setInboxMenuData,
        fetchInboxMenu,
        inboxMenuLoading,
        automationInitialLoaded,
        setAutomationInitialLoaded,
        isGlobalLoading,
        planFeatures,
        planEntitlements,
        planLimits,
        planPureLimits,
        accessState,
        refreshPlanAccess,
        refreshLinkedProfiles,
        hasPlanFeature,
        getPlanGate
    };

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
};

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
};
