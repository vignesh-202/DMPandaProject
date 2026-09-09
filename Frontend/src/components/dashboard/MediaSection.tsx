import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Card from '../ui/card';
import { Plus, RefreshCcw, Calendar, Search, Ghost, Inbox, Loader2, ArrowLeft, Film, Image as ImageIcon, Pencil, Check, ChevronDown, X, AlertCircle, Radio, MessageSquare, Reply } from 'lucide-react';
import ModernCalendar from '../ui/ModernCalendar';
import LoadingOverlay from '../ui/LoadingOverlay';
import { getApiCooldown, setApiTimestamp } from '../../utils/rateLimit';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';
import ToggleSwitch from '../ui/ToggleSwitch';

interface MediaItem {
    id: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    caption?: string;
    timestamp: string;
    has_automation?: boolean;
    automation_id?: string;
    automation_type?: string;
    is_active?: boolean;
}

interface MediaSectionProps {
    title: string;
    type: 'reel' | 'post' | 'story' | 'mention' | 'live';
    onCreateAutomation: (media: MediaItem) => void;
}

const MediaSection: React.FC<MediaSectionProps> = ({ title, type, onCreateAutomation }) => {
    const { mediaCache, updateMediaCache, activeAccountID, activeAccountStats, isLoadingStats, refreshStats, automationInitialLoaded, setAutomationInitialLoaded } = useDashboard();
    const { authenticatedFetch } = useAuth();

    const cacheKey = `${activeAccountID}_${type}`;
    const [mediaItems, setMediaItems] = useState<MediaItem[]>(mediaCache[cacheKey] || []);
    const [loading, setLoading] = useState(!automationInitialLoaded[cacheKey]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
    const [filterDate, setFilterDate] = useState<string>('');
    const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

    const [mediaDateFilter, setMediaDateFilter] = useState<'all' | '7days' | '30days' | 'custom'>('all');
    const [mediaStartDate, setMediaStartDate] = useState('');
    const [mediaEndDate, setMediaEndDate] = useState('');
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [liveAutomations, setLiveAutomations] = useState<any[]>([]);
    const [loadingLiveAutomations, setLoadingLiveAutomations] = useState(false);

    const STORAGE_KEY = `media_${type}_${activeAccountID || 'default'}`;
    const COOLDOWN_TIME = 30;

    // Use ref to keep track of loaded state without triggering re-renders in callback
    const automationInitialLoadedRef = useRef(automationInitialLoaded);
    const fetchingRef = useRef(false);

    useEffect(() => {
        automationInitialLoadedRef.current = automationInitialLoaded;
    }, [automationInitialLoaded]);

    const fetchMedia = useCallback(async (isManualRefresh = false, filter?: string, start?: string, end?: string) => {
        if (!activeAccountID) {
            setLoading(false);
            return;
        }

        if (type === 'live') {
            setMediaItems([]);
            setLoading(false);
            setIsRefreshing(false);
            return;
        }

        // Prevent duplicate requests
        if (fetchingRef.current && !isManualRefresh) {
            return;
        }

        const currentFilter = filter || mediaDateFilter;

        // Use Ref for check to avoid dependency loop
        if (isManualRefresh) {
            setIsRefreshing(true);
        } else if (!automationInitialLoadedRef.current[cacheKey] && currentFilter === 'all') {
            setLoading(true);
        }

        fetchingRef.current = true;
        try {
            const baseUrl = `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram`;
            const endpoint = type === 'mention' ? 'mentions' : 'media';

            const params = new URLSearchParams({
                account_id: activeAccountID,
                limit: '100'
            });
            if (type !== 'mention') params.append('type', type);

            if (currentFilter !== 'all') {
                const until = Math.floor(Date.now() / 1000);
                let since = 0;

                if (currentFilter === '7days') {
                    since = until - (7 * 24 * 60 * 60);
                } else if (currentFilter === '30days') {
                    since = until - (30 * 24 * 60 * 60);
                } else if (currentFilter === 'custom') {
                    const startDate = start || mediaStartDate;
                    const endDate = end || mediaEndDate;
                    if (startDate) since = Math.floor(new Date(startDate).getTime() / 1000);
                    if (endDate) {
                        const endTs = Math.floor(new Date(endDate).getTime() / 1000) + (24 * 60 * 60) - 1;
                        params.append('until', endTs.toString());
                    }
                }

                if (since > 0) params.append('since', since.toString());
                if (currentFilter !== 'custom') params.append('until', until.toString());
            }

            const res = await authenticatedFetch(`${baseUrl}/${endpoint}?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                const fetchedItems = data.data || [];
                setMediaItems(fetchedItems);

                // Only cache 'all' filter results
                if (currentFilter === 'all') {
                    updateMediaCache(cacheKey, fetchedItems);
                    setAutomationInitialLoaded(prev => ({ ...prev, [cacheKey]: true }));
                }

                if (isManualRefresh) {
                    setApiTimestamp(STORAGE_KEY);
                    setCooldown(COOLDOWN_TIME);
                }
            }
        } catch (err) {
            console.error("Failed to fetch media", err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            fetchingRef.current = false;
        }
    }, [activeAccountID, type, cacheKey, authenticatedFetch, updateMediaCache, setAutomationInitialLoaded, STORAGE_KEY, COOLDOWN_TIME, mediaDateFilter, mediaStartDate, mediaEndDate]);

    const fetchLiveAutomations = useCallback(async () => {
        if (!activeAccountID || type !== 'live') {
            setLiveAutomations([]);
            return;
        }

        setLoadingLiveAutomations(true);
        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations?account_id=${activeAccountID}&type=live&summary=1`);
            const data = await res.json();
            if (res.ok) {
                setLiveAutomations((data.automations || []).map((automation: any) => ({
                    ...automation,
                    active: automation?.is_active !== false,
                    is_active: automation?.is_active !== false,
                    keyword_list: Array.isArray(automation?.keywords)
                        ? automation.keywords
                        : (typeof automation?.keyword === 'string'
                            ? automation.keyword.split(',').map((item: string) => item.trim()).filter(Boolean)
                            : [])
                })));
            } else {
                setLiveAutomations([]);
            }
        } catch (err) {
            console.error('Failed to fetch live automations', err);
            setLiveAutomations([]);
        } finally {
            setLoadingLiveAutomations(false);
        }
    }, [activeAccountID, authenticatedFetch, type]);

    const liveAutomationSlots = useMemo(() => {
        if (type !== 'live') return [];

        const allCommentsAutomation = liveAutomations.find(
            (automation) => String(automation?.trigger_type || 'keywords').trim().toLowerCase() === 'all_comments'
        ) || null;
        const keywordAutomations = liveAutomations
            .filter((automation) => String(automation?.trigger_type || 'keywords').trim().toLowerCase() !== 'all_comments')
            .slice(0, 5);

        return [
            {
                slotId: 'live-all-comments',
                slotLabel: 'All Comments',
                slotHint: 'Replies to every live comment',
                automation: allCommentsAutomation
            },
            ...Array.from({ length: 5 }, (_, index) => ({
                slotId: `live-keyword-${index + 1}`,
                slotLabel: `Keyword Automation ${index + 1}`,
                slotHint: 'Set keywords for this live reply flow',
                automation: keywordAutomations[index] || null
            }))
        ];
    }, [liveAutomations, type]);

    useEffect(() => {
        const remaining = getApiCooldown(STORAGE_KEY, COOLDOWN_TIME);
        if (remaining > 0) {
            setCooldown(remaining);
        }

        // Use cached data if available for this specific account/type combination (only for 'all' filter)
        if (activeAccountID && mediaCache[cacheKey] && mediaDateFilter === 'all') {
            setMediaItems(mediaCache[cacheKey]);
            setLoading(false);

            // If already marked as initially loaded, skip auto-fetch
            if (automationInitialLoaded[cacheKey]) {
                return;
            }
        }

        if (activeAccountID) {
            fetchMedia(false);
        }
    }, [activeAccountID, mediaDateFilter, mediaStartDate, mediaEndDate, fetchMedia, type, cacheKey, mediaCache, automationInitialLoaded, STORAGE_KEY, COOLDOWN_TIME]);

    useEffect(() => {
        if (type !== 'live') return;
        if (!activeAccountID) {
            setLiveAutomations([]);
            return;
        }
        fetchLiveAutomations();
    }, [activeAccountID, fetchLiveAutomations, type]);

    useEffect(() => {
        let interval: any;
        const updateTimer = () => {
            const remaining = getApiCooldown(STORAGE_KEY, COOLDOWN_TIME);
            setCooldown(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
            }
        };
        updateTimer();
        interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [STORAGE_KEY, isRefreshing]);

    const handleRefresh = () => {
        if (!isRefreshing) {
            if (type === 'live') {
                setIsRefreshing(true);
                Promise.all([fetchLiveAutomations(), Promise.resolve(refreshStats())])
                    .finally(() => {
                        setApiTimestamp(STORAGE_KEY);
                        setCooldown(COOLDOWN_TIME);
                        setIsRefreshing(false);
                    });
                return;
            }

            fetchMedia(true);
            refreshStats();
        }
    };

    const filteredItems = mediaItems.filter(item => {
        if (!item.media_url) return false;
        if (!filterDate) return true;
        const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
        return itemDate === filterDate;
    });

    const sortedItems = [...filteredItems].sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
    });

    const automationsSet = mediaItems.filter(item => item.has_automation);

    const handleToggleAutomationStatus = async (item: MediaItem) => {
        if (!item.automation_id) return;

        const newStatus = item.is_active === false;

        // Optimistically update local state
        setMediaItems(prev => prev.map(m => {
            if (m.id === item.id) {
                return { ...m, is_active: newStatus };
            }
            return m;
        }));

        try {
            const baseUrl = `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram`;
            const res = await authenticatedFetch(`${baseUrl}/automations/${item.automation_id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_active: newStatus
                })
            });

            if (!res.ok) {
                throw new Error('Failed to update automation status');
            }

            // Update cache
            const updatedItems = mediaItems.map(m => {
                if (m.id === item.id) {
                    return { ...m, is_active: newStatus };
                }
                return m;
            });
            updateMediaCache(cacheKey, updatedItems);

        } catch (err) {
            console.error("Failed to toggle automation status", err);
            // Revert state on error
            setMediaItems(prev => prev.map(m => {
                if (m.id === item.id) {
                    return { ...m, is_active: !newStatus };
                }
                return m;
            }));
        }
    };

    const toggleView = () => {
        setViewMode(viewMode === 'list' ? 'create' : 'list');
    };

    const useShowcaseCards = type === 'post' || type === 'reel' || type === 'story';

    const formatMediaDate = (value: string) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return 'Unknown date';
        return parsed.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatMediaAge = (value: string) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return 'Unknown';
        const diffDays = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 day ago';
        return `${diffDays} days ago`;
    };

    const getMediaPreviewUrl = (item: MediaItem) => toBrowserPreviewUrl(item.thumbnail_url || item.media_url || '');

    const renderShowcaseCard = (item: MediaItem, isAutomated: boolean) => (
        <div className="flex h-full flex-col p-1 sm:p-2.5">
            <div className={cn(
                'relative h-[11rem] overflow-hidden rounded-[1rem] border border-border/70 bg-[#060606] sm:h-[15rem] sm:rounded-[1.35rem] lg:h-[17rem] lg:rounded-[1.5rem]'
            )}>
                <img
                    src={getMediaPreviewUrl(item)}
                    alt={item.caption || 'Media'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35" />
                <div className="absolute left-1.5 top-1.5 sm:left-2.5 sm:top-2.5 flex flex-wrap items-center gap-1 sm:gap-1.5 max-w-[75%]">
                    <div className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                        {type === 'reel' ? 'Reel' : type === 'story' ? 'Story' : 'Post'}
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                        {item.media_type === 'VIDEO' ? 'Video' : item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Image'}
                    </div>
                </div>
                {isAutomated && (
                    <div className={cn(
                        'absolute right-1.5 top-1.5 sm:right-2.5 sm:top-2.5 flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full shadow-sm transition-all text-white',
                        item.is_active !== false ? 'bg-emerald-500' : 'bg-amber-500'
                    )}>
                        {item.is_active !== false ? (
                            <Check className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
                        ) : (
                            <X className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
                        )}
                    </div>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 sm:gap-2 px-0.5 pb-0.5 pt-2 sm:pt-3">
                {type !== 'story' && (
                    <h3 className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug tracking-tight text-foreground">
                        {item.caption?.trim() || (type === 'reel' ? 'Reel automation item' : 'Post automation item')}
                    </h3>
                )}
                {type === 'story' && (
                    <h3 className="line-clamp-1 text-xs sm:text-sm font-semibold leading-snug tracking-tight text-foreground">
                        Story automation item
                    </h3>
                )}
                <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-normal text-muted-foreground">
                    <span>{formatMediaDate(item.timestamp)}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40 hidden sm:block" />
                    <span>{formatMediaAge(item.timestamp)}</span>
                </div>
                <div className="mt-auto flex items-center gap-1.5 sm:gap-2 w-full">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onCreateAutomation(item);
                        }}
                        className={cn(
                            'inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold transition-all flex-1 active:scale-[0.98]',
                            isAutomated
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                        )}
                    >
                        {isAutomated ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {isAutomated ? 'Edit' : 'Setup'}
                    </button>
                    {isAutomated && (
                        <div 
                            className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 bg-muted/40 border border-border/70 rounded-lg h-8 sm:h-9"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ToggleSwitch
                                isChecked={item.is_active !== false}
                                onChange={() => handleToggleAutomationStatus(item)}
                                variant="plain"
                                size="sm"
                            />
                            <span className="text-[10px] font-medium text-muted-foreground min-w-[28px] sm:min-w-[36px] text-center">
                                {item.is_active !== false ? 'Active' : 'Paused'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const hasAnyContent = mediaItems.length > 0;
    const hasAnyAutomation = automationsSet.length > 0;
    // Loading message based on type
    const loadingMessage =
        type === 'reel'
            ? 'Loading Reel Automation'
            : type === 'post'
                ? 'Loading Post Automation'
                : type === 'story'
                    ? 'Loading Story Automation'
                    : type === 'mention'
                        ? 'Loading Mentions Automation'
                        : 'Loading Live Automation';

    const loadingSubMessage = `Fetching your ${type === 'mention' ? 'mentions' : `${type}s`} from Instagram...`;

    // Full-screen loading state for API data loading (wrapper ensures min height so overlay centers in section)
    const isActuallyLoading = loading || (type === 'live' && loadingLiveAutomations && liveAutomations.length === 0);

    if (isActuallyLoading) {
        return (
            <div className="relative min-h-[calc(100dvh-6rem)] w-full">
                <LoadingOverlay
                    variant="fullscreen"
                    message={loadingMessage}
                    subMessage={loadingSubMessage}
                />
            </div>
        );
    }

    const isVerticalType = type === 'reel' || type === 'story' || type === 'live';
    const liveIsActive = Boolean(activeAccountStats?.is_live);

    if (type === 'live') {
        const openLiveEditor = (automation?: any) => {
            onCreateAutomation({
                id: automation?.media_id || 'live-status',
                media_type: 'VIDEO',
                media_url: '',
                thumbnail_url: '',
                permalink: '',
                caption: automation?.title || (liveIsActive ? 'Instagram Live is active' : 'Live automation'),
                timestamp: new Date().toISOString(),
                ...(automation?.$id ? { automation_id: automation.$id } : (automation?.id ? { automation_id: automation.id } : {}))
            } as MediaItem);
        };

        const handleToggleLiveSlot = async (automation: any) => {
            const autoId = automation?.$id || automation?.id;
            if (!autoId) return;
            const newStatus = automation.is_active === false;

            setLiveAutomations(prev => prev.map(a =>
                (a.$id === autoId || a.id === autoId) ? { ...a, is_active: newStatus } : a
            ));

            try {
                const baseUrl = `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram`;
                const res = await authenticatedFetch(`${baseUrl}/automations/${autoId}?type=live`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: newStatus })
                });
                if (!res.ok) throw new Error('Failed to toggle live automation');
            } catch (err) {
                setLiveAutomations(prev => prev.map(a =>
                    (a.$id === autoId || a.id === autoId) ? { ...a, is_active: !newStatus } : a
                ));
            }
        };

        const activeCount = liveAutomations.filter(a => a.is_active !== false).length;

        return (
            <div className="bg-card text-card-foreground rounded-2xl border border-border/80 p-5 sm:p-6 flex flex-col transition-all">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border/60">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h2>
                            {liveIsActive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Live Now
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                    Stream Offline
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {liveIsActive
                                ? 'Broadcasting live · Automations are actively responding to viewer comments.'
                                : 'Automate responses to viewer comments during Instagram Live sessions.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                        {activeAccountID && (
                            <button
                                onClick={handleRefresh}
                                disabled={cooldown > 0 || isRefreshing}
                                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted/70 text-foreground text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={cooldown > 0 ? `Rate limit active: Wait ${cooldown} seconds` : 'Refresh live status and automations'}
                            >
                                <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-muted-foreground' : ''}`} />
                                {cooldown > 0 ? (
                                    <span className="tabular-nums">Wait {cooldown}s</span>
                                ) : (
                                    <span>Refresh Status</span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Configured Slots Header */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-sm font-semibold text-foreground">Automation Slots</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border/60">
                            {activeCount} active · {liveAutomations.length} configured
                        </span>
                    </div>
                </div>

                {loadingLiveAutomations ? (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">Loading live automation slots...</p>
                    </div>
                ) : (
                    <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {liveAutomationSlots.map((slot, index) => {
                            const automation = slot.automation;
                            const keywordList = Array.isArray(automation?.keyword_list) ? automation.keyword_list : [];
                            const isAllComments = slot.slotLabel === 'All Comments';
                            const hasCommentReply = Boolean(String(automation?.comment_reply || '').trim());
                            const isConfigured = Boolean(automation);
                            const isActive = automation?.is_active !== false;

                            return (
                                <div
                                    key={slot.slotId}
                                    className={`flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
                                        isConfigured
                                            ? 'border-border/80 bg-card hover:border-foreground/25 hover:shadow-sm'
                                            : 'border-dashed border-border/90 bg-muted/10 hover:border-border hover:bg-muted/20'
                                    }`}
                                >
                                    <div>
                                        {/* Slot Top Bar */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span className="inline-block text-[11px] font-medium text-muted-foreground">
                                                    {isAllComments ? 'Universal Trigger' : `Keyword Slot ${index}`}
                                                </span>
                                                <h4 className="mt-1 text-sm font-semibold text-foreground truncate">
                                                    {automation?.title || (isAllComments ? 'All Comments Mode' : `Keyword Automation ${index}`)}
                                                </h4>
                                            </div>

                                            {isConfigured ? (
                                                <div 
                                                    className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 border border-border/70 rounded-lg shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ToggleSwitch
                                                        isChecked={isActive}
                                                        onChange={() => handleToggleLiveSlot(automation)}
                                                        variant="plain"
                                                        size="sm"
                                                    />
                                                    <span className="text-[10px] font-medium text-muted-foreground min-w-[32px] text-center">
                                                        {isActive ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border/50 shrink-0">
                                                    Available
                                                </span>
                                            )}
                                        </div>

                                        {/* Slot Content */}
                                        <div className="mt-3.5">
                                            {!isConfigured ? (
                                                <p className="text-xs text-muted-foreground">
                                                    {isAllComments 
                                                        ? 'Replies to every viewer comment on stream.'
                                                        : 'Replies when viewers type targeted keywords.'}
                                                </p>
                                            ) : isAllComments ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                                                        <Reply className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                        <span>Universal responder</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Replies to every comment regardless of keywords.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                                                        {keywordList.length > 0 ? 'Trigger keywords:' : 'No keywords set'}
                                                    </div>
                                                    {keywordList.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {keywordList.map((kw: string) => (
                                                                <span key={kw} className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">
                                                            No keywords configured yet.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Metadata Summary */}
                                        {isConfigured && (
                                            <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-3 text-[11px] text-muted-foreground">
                                                <span>DM: <strong className="font-medium text-foreground">On</strong></span>
                                                <span>•</span>
                                                <span>Public Reply: <strong className="font-medium text-foreground">{hasCommentReply ? 'On' : 'Off'}</strong></span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        type="button"
                                        onClick={() => openLiveEditor(automation || undefined)}
                                        className={`mt-5 w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3.5 text-xs font-medium transition-all active:scale-[0.98] ${
                                            isConfigured
                                                ? 'bg-foreground text-background hover:bg-foreground/90 shadow-xs'
                                                : 'border border-border/80 bg-background hover:bg-muted text-foreground hover:border-foreground/30'
                                        }`}
                                    >
                                        {isConfigured ? (
                                            <span>Edit Automation</span>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Configure Slot</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-black p-3 sm:p-6 rounded-3xl h-full min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
            <div className="space-y-4 mb-6 sm:mb-8">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4 w-full">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            {viewMode === 'create' && (type === 'reel' || type === 'post') && (
                                <button
                                    onClick={() => setViewMode('list')}
                                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-content bg-card text-foreground transition-all hover:bg-muted/40 shrink-0"
                                    aria-label="Back to list"
                                    title="Back to list"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            )}
                            <div className="min-w-0 flex-1">
                                <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">{title}</h2>
                                {type === 'story' && (
                                    <p className="text-xs font-medium text-primary mt-1.5 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        Showing active 24h stories
                                    </p>
                                )}
                            </div>
                        </div>

                        {activeAccountID && (
                            <button
                                onClick={handleRefresh}
                                disabled={cooldown > 0 || isRefreshing}
                                className="group relative h-9 px-3.5 bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground rounded-xl transition-all border border-border disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs shrink-0"
                                title={cooldown > 0 ? `Rate limit active: Wait ${cooldown} seconds` : "Refresh items from Instagram"}
                            >
                                <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {cooldown > 0 ? (
                                    <span className="text-xs font-medium tabular-nums">{cooldown}s</span>
                                ) : (
                                    <span className="text-xs font-medium hidden sm:inline">Refresh</span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Consolidated Filters in Header */}
                    {((viewMode === 'create' || type === 'mention') && hasAnyContent) && (
                        <div className="flex flex-wrap gap-2 items-center justify-end md:justify-start">
                            {/* Date Filter Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => { setDateDropdownOpen(!dateDropdownOpen); setSortDropdownOpen(false); }}
                                    className="group flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-muted/60"
                                >
                                    <Calendar className={`w-3.5 h-3.5 ${mediaDateFilter !== 'all' ? 'text-primary' : 'text-muted-foreground'} transition-colors group-hover:text-primary`} />
                                    <span>
                                        {mediaDateFilter === 'all' ? 'All Time' :
                                            mediaDateFilter === '7days' ? 'Last 7 Days' :
                                                mediaDateFilter === '30days' ? 'Last 30 Days' : 'Custom'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${dateDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
                                </button>

                                {dateDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setDateDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 z-[70] mt-2 min-w-[190px] overflow-hidden rounded-[1.35rem] border border-border/80 bg-card/98 p-1.5 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl animate-in zoom-in-95 duration-200">
                                            {[
                                                { id: 'all', label: 'All Time' },
                                                { id: '7days', label: 'Last 7 Days' },
                                                { id: '30days', label: 'Last 30 Days' },
                                                { id: 'custom', label: 'Custom Range' }
                                            ].map((f) => (
                                                <button
                                                    key={f.id}
                                                    onClick={() => {
                                                        setMediaDateFilter(f.id as any);
                                                        if (f.id !== 'custom') setDateDropdownOpen(false);
                                                    }}
                                                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${mediaDateFilter === f.id ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground hover:bg-muted/60'}`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                            {mediaDateFilter === 'custom' && (
                                                <div className="mt-2 rounded-xl border border-border bg-background p-1 animate-in slide-in-from-top-2">
                                                    <ModernCalendar
                                                        startDate={mediaStartDate}
                                                        endDate={mediaEndDate}
                                                        onSelect={(start: string, end: string) => {
                                                            setMediaStartDate(start);
                                                            setMediaEndDate(end);
                                                        }}
                                                        onClose={() => setDateDropdownOpen(false)}
                                                    />
                                                    {(mediaStartDate || mediaEndDate) && (
                                                        <div className="border-t border-border p-2">
                                                            <button
                                                                onClick={(e) => { e.preventDefault(); setDateDropdownOpen(false); }}
                                                                className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90"
                                                            >
                                                                Apply Range
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Sort Filter Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => { setSortDropdownOpen(!sortDropdownOpen); setDateDropdownOpen(false); }}
                                    className="group flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-muted/60"
                                >
                                    <RefreshCcw className="w-3.5 h-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                                    <span>
                                        {sortOrder === 'recent' ? 'Recent' : 'Oldest'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
                                </button>

                                {sortDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setSortDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 z-[70] mt-2 min-w-[140px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-md backdrop-blur-xl animate-in zoom-in-95 duration-150">
                                            <button
                                                onClick={() => { setSortOrder('recent'); setSortDropdownOpen(false); }}
                                                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${sortOrder === 'recent' ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground hover:bg-muted/60'}`}
                                            >
                                                Recent
                                            </button>
                                            <button
                                                onClick={() => { setSortOrder('oldest'); setSortDropdownOpen(false); }}
                                                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${sortOrder === 'oldest' ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground hover:bg-muted/60'}`}
                                            >
                                                Oldest
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Full-width Create button below for post/reel */}
                {type !== 'mention' && type !== 'story' && !(viewMode === 'create' && (type === 'reel' || type === 'post')) && hasAnyContent && (
                    <button
                        onClick={toggleView}
                        className="w-full md:w-auto h-10 px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-xs sm:text-sm active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
                    >
                        {viewMode === 'list' ? (
                            <>
                                <Plus className="w-4 h-4" />
                                Create New
                            </>
                        ) : (type === 'reel' || type === 'post') ? null : (
                            <>View All List</>
                        )}
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col">
                {/* CASE 1: No content found on account at all */}
                        {!hasAnyContent && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-card rounded-2xl border border-dashed border-border animate-in fade-in zoom-in-95 duration-300">
                                <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-4 text-muted-foreground">
                                    <Ghost className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-semibold text-foreground mb-1">
                                    {type === 'mention' ? "No Mentions Found" : type === 'story' ? "No Stories Found" : `No ${type.charAt(0).toUpperCase() + type.slice(1)}s Found`}
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-6">
                                    {type === 'story' ? (
                                        "Stories disappear after 24 hours. We only fetch currently active stories."
                                    ) : (
                                        `We couldn't find any recent ${type}s on your connected Instagram account.`
                                    )}
                                </p>

                                <button
                                    onClick={handleRefresh}
                                    disabled={cooldown > 0 || isRefreshing}
                                    className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>
                        )}

                        {/* CASE 2: Content exists, but no automations -> CTA State */}
                        {hasAnyContent && !hasAnyAutomation && viewMode === 'list' && type !== 'mention' && type !== 'story' && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-card rounded-2xl border border-dashed border-border animate-in fade-in duration-300">
                                <div className="relative mb-4">
                                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
                                        <Inbox className="w-6 h-6" />
                                    </div>
                                    <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-5">
                                        {mediaItems.length}
                                    </span>
                                </div>
                                <h3 className="text-base font-semibold text-foreground mb-1">
                                    Ready to Automate
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-6">
                                    {`You have ${mediaItems.length} ${type}s available. Select one to start setting up auto-replies and boost your engagement.`}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center max-w-xs sm:max-w-md">
                                    <button
                                        onClick={() => setViewMode('create')}
                                        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-xs sm:text-sm active:scale-[0.98] transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Start First Automation
                                    </button>
                                    <button
                                        onClick={handleRefresh}
                                        disabled={cooldown > 0 || isRefreshing}
                                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs sm:text-sm active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CASE 3: Active Automations view */}
                        {hasAnyAutomation && viewMode === 'list' && (
                            <div className={cn(
                                'grid gap-6',
                                useShowcaseCards
                                    ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                                    : 'grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                            )}>
                                {automationsSet.map(item => (
                                    <Card
                                        key={item.id}
                                        onClick={() => onCreateAutomation(item)}
                                        className={cn(
                                            'group h-full cursor-pointer overflow-hidden border p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl',
                                            useShowcaseCards
                                                ? 'min-h-[18.5rem] rounded-[1.35rem] border-border bg-card shadow-sm sm:min-h-[20.5rem] sm:rounded-[1.6rem] lg:min-h-[23rem] lg:rounded-[1.8rem]'
                                                : 'relative rounded-3xl border-0 bg-gray-50 shadow-lg dark:bg-gray-900'
                                        )}
                                    >
                                        {useShowcaseCards ? (
                                            renderShowcaseCard(item, true)
                                        ) : (
                                            <div className={`relative overflow-hidden ${isVerticalType ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
                                                <img
                                                    src={getMediaPreviewUrl(item)}
                                                    alt={item.caption || "Media"}
                                                    className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90 opacity-80 group-hover:opacity-100 transition-opacity" />

                                                <div className="absolute top-3 right-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                                                </div>

                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                                    <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-3">
                                                        <RefreshCcw className="w-5 h-5 text-white" />
                                                    </div>
                                                    <p className="text-white font-bold text-xs uppercase tracking-widest mb-2 drop-shadow-md">Active</p>

                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onCreateAutomation(item);
                                                        }}
                                                        className="mt-2 px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors shadow-lg"
                                                    >
                                                        Manage
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* CASE 4: Selection Grid (Create Mode) */}
                        {((viewMode === 'create' && hasAnyContent) || type === 'mention' || (type === 'story' && hasAnyContent && !hasAnyAutomation && viewMode === 'list')) && (
                            <div className="relative min-h-[360px] flex-1 sm:min-h-[500px]">

                                {sortedItems.length === 0 ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 animate-in fade-in duration-500">
                                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                                            <Search className="w-10 h-10" />
                                        </div>
                                        <h4 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">No Results Found</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs font-medium">We couldn't find any {type}s for the selected filters.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 flex-1">
                                        <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                            <AlertCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                                            <p className="text-[9px] font-bold text-blue-500/80 uppercase tracking-widest leading-relaxed">
                                                Note: Instagram allows fetching up to 10,000 recently created posts and reels through the workspace.
                                            </p>
                                        </div>
                                        <div
                                            key={type + mediaDateFilter}
                                            className={cn(
                                                'grid gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto pr-2 max-h-[800px] scrollbar-thin',
                                                useShowcaseCards
                                                    ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                                                    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                                            )}
                                        >
                                            {sortedItems.map((item) => {
                                                const isAutomated = Boolean(item.has_automation);
                                                return (
                                                    <Card
                                                        key={item.id}
                                                        onClick={() => onCreateAutomation(item)}
                                                        className={cn(
                                                            'group h-full cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl',
                                                            useShowcaseCards
                                                                ? `min-h-[18.5rem] rounded-[1.35rem] border border-border bg-card p-0 shadow-sm sm:min-h-[20.5rem] sm:rounded-[1.6rem] lg:min-h-[23rem] lg:rounded-[1.8rem] ${isAutomated ? 'ring-2 ring-primary/20' : 'hover:ring-2 hover:ring-primary/20'}`
                                                                : `rounded-[2rem] border-0 bg-slate-50 p-0 shadow-md dark:bg-slate-900 ${isAutomated ? 'ring-2 ring-blue-500/20' : 'hover:ring-4 ring-blue-500/30'}`
                                                        )}
                                                    >
                                                        {useShowcaseCards ? (
                                                            renderShowcaseCard(item, isAutomated)
                                                        ) : (
                                                            <div className={`relative overflow-hidden ${isVerticalType ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
                                                                <img
                                                                    src={getMediaPreviewUrl(item)}
                                                                    alt={item.caption || "Media"}
                                                                    className={`object-cover w-full h-full transition-all duration-700 group-hover:scale-110 ${isAutomated ? 'grayscale hover:grayscale-0 brightness-[0.8] group-hover:brightness-100' : ''}`}
                                                                    loading="lazy"
                                                                />

                                                                <div className="absolute top-3 inset-x-3 flex justify-between items-start pointer-events-none">
                                                                    <div className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-white text-[10px] font-medium border border-white/10">
                                                                        {item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : item.media_type === 'VIDEO' ? 'Video' : 'Image'}
                                                                    </div>
                                                                    {isAutomated && (
                                                                        <div className="bg-primary text-primary-foreground p-1.5 rounded-full shadow-sm">
                                                                            <Check className="w-3 h-3 stroke-[2.5]" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className={`absolute inset-0 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px] ${isAutomated ? 'bg-primary/20 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'}`}>
                                                                    {isAutomated ? (
                                                                        <div className="flex flex-col items-center gap-2">
                                                                            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold text-xs shadow-sm flex items-center gap-2">
                                                                                <Pencil className="w-3.5 h-3.5" /> Edit Automation
                                                                            </div>
                                                                            <span className="text-[10px] font-medium text-white/90">Active</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-card text-foreground px-4 py-2 rounded-xl font-semibold text-xs shadow-md flex items-center gap-2">
                                                                            <Plus className="w-3.5 h-3.5" /> Setup Automation
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                                                    <div className="flex items-center gap-1.5 mb-1 text-white/80">
                                                                        <Calendar className="w-3 h-3" />
                                                                        <span className="text-[10px] font-medium">
                                                                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs line-clamp-2 font-medium text-white leading-snug">
                                                                        {item.caption || "No Caption Provided"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
            </div>
        </div>
    );
};

export default MediaSection;

