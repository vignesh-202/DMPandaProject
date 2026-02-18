import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

export type ViewType =
    | 'Dashboard'
    | 'Analytics'
    | 'Reply Templates'
    | 'Super Profile'
    | 'Inbox Menu'
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
    | 'Affiliate & Referral'
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
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [currentView, setCurrentView] = useState<ViewType>('Dashboard');
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
    const [inboxMenuData, setInboxMenuData] = useState<any | null>(null);
    const [inboxMenuLoading, setInboxMenuLoading] = useState(false);
    const [automationInitialLoaded, setAutomationInitialLoaded] = useState<Record<string, boolean>>({});
    const isFetchingInboxMenu = useRef(false);

    const [isGlobalLoading, setIsGlobalLoading] = useState(true);

    const { authenticatedFetch } = useAuth();

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

    // Ref to track the last synced values to prevent duplicate sync calls
    const lastSyncedValues = React.useRef<{
        accountId: string | null;
        profile_picture_url: string;
        username: string;
        name: string;
    } | null>(null);

    // Fetch account stats
    const fetchStats = useCallback(async (accountId: string, accountsOverride?: any[]) => {
        const sourceAccounts = accountsOverride || igAccountsRef.current;
        const account = sourceAccounts.find(a => a.ig_user_id === accountId || a.id === accountId);

        if (account?.status !== 'active') {
            setActiveAccountStats(null);
            lastFetchedStatsAccountID.current = null;
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

    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    const isFetchingAccounts = useRef(false);

    // Unified accounts fetch with automatic sync
    const fetchIgAccounts = useCallback(async () => {
        if (isFetchingAccounts.current) return;
        isFetchingAccounts.current = true;

        // Clear lastSyncedValues on login/refresh to ensure sync runs every time
        lastSyncedValues.current = null;

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
                    // Logic to determine ID for initial load
                    let initialTargetID: string | null = null;

                    const firstActive = accounts.find((a: any) => a.status === 'active');
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

                    // Critical: If this is the initial load, we must ensure stats are fetched before unblocking
                    // We also set lastFetchedStatsAccountID immediately to prevent the useEffect watcher from double-fetching.
                    if (initialTargetID) {
                        const targetAcc = accounts.find((a: any) => a.ig_user_id === initialTargetID || a.id === initialTargetID);
                        if (targetAcc && targetAcc.status === 'active') {
                            // Pre-set the ref so the useEffect hook sees it as 'already fetched'
                            lastFetchedStatsAccountID.current = initialTargetID;
                            await fetchStats(initialTargetID, accounts);
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
    }, [authenticatedFetch, fetchStats]);

    // Initial load
    useEffect(() => {
        if (user) {
            fetchIgAccounts();
        }
    }, [user?.id, fetchIgAccounts]);

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
        // Clear last synced values when account changes
        lastSyncedValues.current = null;

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

    // Sync profile data (pic, username, name) when stats are loaded and different from active account record
    useEffect(() => {
        const syncProfile = async () => {
            const stats = activeAccountStats;
            // CRITICAL: stats._accountId is the ig_user_id. activeAccount.id is the Appwrite Doc ID.
            // We must cross-reference using the ig_user_id to ensure we are syncing the correct account.
            if (!stats || !activeAccount || stats._accountId !== activeAccount.ig_user_id || activeAccount.status !== 'active') return;

            const statsUrl = stats.profile_picture_url || '';
            const currentUrl = activeAccount?.profile_picture_url || '';
            const statsUsername = stats.username || '';
            const currentUsername = activeAccount?.username || '';
            const statsName = stats.name || '';
            const currentName = activeAccount?.name || '';

            // Check if we've already synced these exact values for this account
            const accountId = activeAccount.id;
            if (lastSyncedValues.current &&
                lastSyncedValues.current.accountId === accountId &&
                lastSyncedValues.current.profile_picture_url === statsUrl &&
                lastSyncedValues.current.username === statsUsername &&
                lastSyncedValues.current.name === statsName) {
                // Already synced these exact values, skip
                return;
            }

            // Compare data and check for differences - use strict equality check
            const isPicDifferent = statsUrl !== currentUrl;
            const isUsernameDifferent = statsUsername !== currentUsername;
            const isNameDifferent = statsName !== currentName;

            // Only sync if there are actual differences
            if (isPicDifferent || isUsernameDifferent || isNameDifferent) {
                console.log(`[Sync] Detecting changes for @${currentUsername}:`, { isPicDifferent, isUsernameDifferent, isNameDifferent });
                try {
                    // Send the internal Appwrite ID for direct document access
                    const updatePayload: any = { account_id: activeAccount.id };
                    if (isPicDifferent) updatePayload.profile_picture_url = statsUrl;
                    if (isUsernameDifferent) updatePayload.username = statsUsername;
                    if (isNameDifferent) updatePayload.name = statsName;

                    const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/ig-accounts/sync-profile`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatePayload)
                    });

                    if (response.ok) {
                        console.log(`[Sync] Successfully updated @${statsUsername} in database.`);
                        // Track the synced values to prevent duplicate calls
                        lastSyncedValues.current = {
                            accountId: accountId,
                            profile_picture_url: statsUrl,
                            username: statsUsername,
                            name: statsName
                        };
                        setIgAccounts(prev => prev.map(acc =>
                            (acc.id === activeAccount.id)
                                ? { ...acc, ...updatePayload }
                                : acc
                        ));
                    } else {
                        const errData = await response.json();
                        console.error('[Sync] Backend failed to update profile:', errData);
                    }
                } catch (error) {
                    console.error('[Sync] Error syncing profile:', error);
                }
            } else {
                // Data is the same, track it to prevent future unnecessary checks
                lastSyncedValues.current = {
                    accountId: accountId,
                    profile_picture_url: statsUrl,
                    username: statsUsername,
                    name: statsName
                };
            }
        };

        syncProfile();
    }, [activeAccountStats, activeAccount, authenticatedFetch]);

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
                // Task 1: Store inbox menu in frontend for future edits
                if (data.db_menu && data.db_menu.length > 0) {
                    localStorage.setItem(`inbox_menu_${activeAccountID}`, JSON.stringify(data.db_menu));
                } else if (data.ig_menu && data.ig_menu.length > 0) {
                    localStorage.setItem(`inbox_menu_${activeAccountID}`, JSON.stringify(data.ig_menu));
                }
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

        isFetchingConvoStarters.current = true;
        setConvoStarterLoading(true);
        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/convo-starters?account_id=${activeAccountID}`);
            if (response.ok) {
                const data = await response.json();
                setConvoStarterData(data);
                // Store convo starters in frontend for future edits
                if (data.db_starters && data.db_starters.length > 0) {
                    localStorage.setItem(`convo_starters_${activeAccountID}`, JSON.stringify(data.db_starters));
                    setConvoStarters(data.db_starters);
                } else if (data.ig_starters && data.ig_starters.length > 0) {
                    localStorage.setItem(`convo_starters_${activeAccountID}`, JSON.stringify(data.ig_starters));
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
            setConvoStarterLoading(false);
        }
    }, [activeAccountID, authenticatedFetch, convoStarterData]);

    const updateMediaCache = (type: string, items: any[]) => {
        setMediaCache(prev => ({ ...prev, [type]: items }));
    };

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveUnsavedChanges, setSaveUnsavedChanges] = useState<() => Promise<boolean>>(() => async () => true);
    const [discardUnsavedChanges, setDiscardUnsavedChanges] = useState<() => void>(() => () => { });

    const value = {
        currentView,
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
        isGlobalLoading
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
