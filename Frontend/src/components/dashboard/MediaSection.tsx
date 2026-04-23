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

interface MediaItem {
    id: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    caption?: string;
    timestamp: string;
    has_automation?: boolean;
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
            const baseUrl = `${import.meta.env.VITE_API_BASE_URL}/api/instagram`;
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
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}&type=live&summary=1`);
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
        <div className="flex h-full flex-col p-2.5">
            <div className={cn(
                'relative h-[17rem] overflow-hidden rounded-[1.5rem] border border-border/70 bg-[#060606]'
            )}>
                <img
                    src={getMediaPreviewUrl(item)}
                    alt={item.caption || 'Media'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/35" />
                <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                    <div className="rounded-full bg-black/60 px-2 py-1 text-[7px] font-black uppercase tracking-[0.22em] text-white backdrop-blur-md">
                        {type === 'reel' ? 'Reel' : type === 'story' ? 'Story' : 'Post'}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[7px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-md">
                        {item.media_type === 'VIDEO' ? 'Video' : item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Image'}
                    </div>
                </div>
                {isAutomated && (
                    <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-2 px-0.5 pb-0.5 pt-3">
                {type !== 'story' && (
                    <h3 className="line-clamp-2 text-[13px] font-black leading-snug tracking-tight text-foreground">
                        {item.caption?.trim() || (type === 'reel' ? 'Reel automation item' : 'Post automation item')}
                    </h3>
                )}
                {type === 'story' && (
                    <h3 className="line-clamp-1 text-[13px] font-black leading-snug tracking-tight text-foreground">
                        Story automation item
                    </h3>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                    <span>{formatMediaDate(item.timestamp)}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span>{formatMediaAge(item.timestamp)}</span>
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onCreateAutomation(item);
                    }}
                    className={cn(
                        'mt-auto inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.16em] transition-all',
                        isAutomated
                            ? 'bg-primary/12 text-primary hover:bg-primary/18'
                            : 'bg-foreground text-background hover:bg-foreground/90'
                    )}
                >
                    {isAutomated ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {isAutomated ? 'Edit' : 'Setup'}
                </button>
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
    if (loading) {
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
                ...(automation?.$id ? { automation_id: automation.$id } : {})
            } as MediaItem);
        };

        return (
            <div className="bg-white dark:bg-black p-6 rounded-3xl h-full min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-black dark:text-white tracking-tight">{title}</h2>
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${liveIsActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {isLoadingStats ? 'Checking live status' : liveIsActive ? 'Instagram Live is active right now' : 'No active live detected right now'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {activeAccountID && (
                            <button
                                onClick={handleRefresh}
                                disabled={cooldown > 0 || isRefreshing}
                                className="group relative px-4 py-2 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                                title={cooldown > 0 ? `Rate limit active: Wait ${cooldown} seconds` : 'Refresh live status and automations'}
                            >
                                <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''} group-hover:rotate-180 transition-transform duration-700`} />
                                {cooldown > 0 ? (
                                    <span className="text-[10px] font-black tracking-tighter tabular-nums">{cooldown}s</span>
                                ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Refresh</span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card className={`relative overflow-hidden rounded-[2rem] border p-6 ${liveIsActive ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-content bg-card/80'}`}>
                        <div className="flex items-start gap-4">
                            <div className={`mt-1 flex h-14 w-14 items-center justify-center rounded-2xl ${liveIsActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300'}`}>
                                <Radio className={`h-6 w-6 ${liveIsActive ? 'animate-pulse' : ''}`} />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Live Status</p>
                                    <h3 className="mt-2 text-2xl font-black text-foreground">{isLoadingStats ? 'Scanning Instagram Live' : liveIsActive ? 'Live automation can trigger now' : 'Live automation is ready for your next stream'}</h3>
                                    <p className="mt-2 text-sm font-medium text-muted-foreground">
                                        {liveIsActive
                                            ? 'Your broadcast is currently active, so live automations can respond immediately to matching comments.'
                                            : 'You can configure everything in advance while live is offline. The automations will be ready to respond as soon as your next Instagram Live starts.'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-content/70 bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">1 all-comments trigger</span>
                                    <span className="rounded-full border border-content/70 bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">Up to 5 keywords</span>
                                    <span className="rounded-full border border-content/70 bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">Public comment reply</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="rounded-[2rem] border border-content bg-card/80 p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Live Trigger Modes</p>
                        <div className="mt-4 space-y-3">
                            <div className="rounded-2xl border border-content/70 bg-card px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                                        <MessageSquare className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-foreground">Keyword Replies</p>
                                        <p className="text-[11px] font-medium text-muted-foreground">Set up to 5 live keywords that each open the DM flow and optional public comment reply.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-content/70 bg-card px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                                        <Reply className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-foreground">All Comments Mode</p>
                                        <p className="text-[11px] font-medium text-muted-foreground">Create one all-comments automation for live so every comment can trigger the same reply flow.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="mt-6 flex-1 rounded-[2rem] border border-content bg-card/80 p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Configured Live Automations</p>
                            <h3 className="mt-2 text-xl font-black text-foreground">{liveAutomations.length > 0 ? `${liveAutomations.length} live automation${liveAutomations.length === 1 ? '' : 's'} ready` : 'No live automations yet'}</h3>
                            <p className="mt-1 text-sm font-medium text-muted-foreground">
                                Manage your saved live comment automations here. They stay available whether the live session is currently active or not.
                            </p>
                        </div>
                    </div>

                    {loadingLiveAutomations ? (
                        <div className="flex min-h-[220px] items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {liveAutomationSlots.map((slot) => {
                                const automation = slot.automation;
                                const keywordList = Array.isArray(automation?.keyword_list) ? automation.keyword_list : [];
                                const isAllComments = slot.slotLabel === 'All Comments';
                                const hasCommentReply = Boolean(String(automation?.comment_reply || '').trim());

                                return (
                                    <Card key={slot.slotId} className={`rounded-[1.75rem] border p-5 shadow-sm ${automation ? 'border-content bg-card' : 'border-dashed border-content/70 bg-muted/20'}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">{slot.slotLabel}</p>
                                                <h4 className="mt-2 text-lg font-black text-foreground">{automation?.title || slot.slotHint}</h4>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${automation ? (automation.is_active !== false ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300') : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                {automation ? (automation.is_active !== false ? 'Active' : 'Paused') : 'Empty'}
                                            </span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {!automation ? (
                                                <span className="rounded-full border border-content/70 bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">Setup available</span>
                                            ) : isAllComments ? (
                                                <span className="rounded-full border border-content/70 bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-foreground">Replies to every live comment</span>
                                            ) : keywordList.map((keyword: string) => (
                                                <span key={keyword} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            <span className="rounded-full border border-content/70 bg-card px-3 py-1">{automation ? (hasCommentReply ? 'Comment Reply On' : 'DM Only') : 'Not configured'}</span>
                                            <span className="rounded-full border border-content/70 bg-card px-3 py-1">{automation ? (keywordList.length > 0 ? `${keywordList.length}/5 keywords` : '1 automation slot used') : (isAllComments ? 'All-comments slot' : 'Keyword slot')}</span>
                                        </div>

                                        <button
                                            onClick={() => openLiveEditor(automation || undefined)}
                                            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-black px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                                        >
                                            {automation ? 'Manage Automation' : 'Setup Automation'}
                                        </button>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-black p-6 rounded-3xl h-full min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    {viewMode === 'create' && (type === 'reel' || type === 'post') && (
                        <button
                            onClick={() => setViewMode('list')}
                            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-content bg-card text-foreground transition-all hover:bg-muted/40"
                            aria-label="Back to list"
                            title="Back to list"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-3xl font-black text-black dark:text-white tracking-tight">{title}</h2>
                        {type === 'story' && (
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Showing active 24h stories
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {activeAccountID && (
                        <button
                            onClick={handleRefresh}
                            disabled={cooldown > 0 || isRefreshing}
                            className="group relative px-4 py-2 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                            title={cooldown > 0 ? `Rate limit active: Wait ${cooldown} seconds` : "Refresh items from Instagram"}
                        >
                            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''} group-hover:rotate-180 transition-transform duration-700`} />
                            {cooldown > 0 ? (
                                <span className="text-[10px] font-black tracking-tighter tabular-nums">{cooldown}s</span>
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Refresh</span>
                            )}
                        </button>
                    )}

                    {/* Consolidated Filters in Header */}
                    {(viewMode === 'create' || type === 'mention') && hasAnyContent && (
                        <>
                            {/* Date Filter Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => { setDateDropdownOpen(!dateDropdownOpen); setSortDropdownOpen(false); }}
                                    className="group flex h-11 items-center gap-2 rounded-2xl border border-border/80 bg-background/90 px-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.7)] transition-all hover:border-primary/35 hover:bg-card"
                                >
                                    <Calendar className={`w-3.5 h-3.5 ${mediaDateFilter !== 'all' ? 'text-primary' : 'text-muted-foreground/60'} transition-colors group-hover:text-primary`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                        {mediaDateFilter === 'all' ? 'All Time' :
                                            mediaDateFilter === '7days' ? 'Last 7 Days' :
                                                mediaDateFilter === '30days' ? 'Last 30 Days' : 'Custom'}
                                    </span>
                                    <span className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border/70 bg-card/80 transition-colors group-hover:border-primary/35">
                                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${dateDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
                                    </span>
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
                                                    className={`w-full rounded-xl px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider transition-all ${mediaDateFilter === f.id ? 'bg-primary text-primary-foreground shadow-[0_18px_34px_-24px_rgba(99,102,241,0.9)]' : 'text-foreground hover:bg-background/80 hover:text-primary'}`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                            {mediaDateFilter === 'custom' && (
                                                <div className="mt-2 rounded-2xl border border-border/70 bg-background/80 p-1 animate-in slide-in-from-top-2">
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
                                                        <div className="border-t border-border/70 p-2">
                                                            <button
                                                                onClick={(e) => { e.preventDefault(); setDateDropdownOpen(false); }}
                                                                className="w-full rounded-xl bg-primary py-2 text-[9px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
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
                                    className="group flex h-11 items-center gap-2 rounded-2xl border border-border/80 bg-background/90 px-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.7)] transition-all hover:border-primary/35 hover:bg-card"
                                >
                                    <RefreshCcw className="w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-500 group-hover:rotate-180 group-hover:text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                        {sortOrder === 'recent' ? 'Recent' : 'Oldest'}
                                    </span>
                                    <span className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border/70 bg-card/80 transition-colors group-hover:border-primary/35">
                                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${sortDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
                                    </span>
                                </button>

                                {sortDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setSortDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 z-[70] mt-2 min-w-[160px] overflow-hidden rounded-[1.35rem] border border-border/80 bg-card/98 p-1.5 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl animate-in zoom-in-95 duration-200">
                                            <button
                                                onClick={() => { setSortOrder('recent'); setSortDropdownOpen(false); }}
                                                className={`w-full rounded-xl px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider transition-all ${sortOrder === 'recent' ? 'bg-primary text-primary-foreground shadow-[0_18px_34px_-24px_rgba(99,102,241,0.9)]' : 'text-foreground hover:bg-background/80 hover:text-primary'}`}
                                            >
                                                Recent
                                            </button>
                                            <button
                                                onClick={() => { setSortOrder('oldest'); setSortDropdownOpen(false); }}
                                                className={`w-full rounded-xl px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider transition-all ${sortOrder === 'oldest' ? 'bg-primary text-primary-foreground shadow-[0_18px_34px_-24px_rgba(99,102,241,0.9)]' : 'text-foreground hover:bg-background/80 hover:text-primary'}`}
                                            >
                                                Oldest
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {type !== 'mention' && type !== 'story' && !(viewMode === 'create' && (type === 'reel' || type === 'post')) && hasAnyContent && (
                        <button
                            onClick={toggleView}
                            className="bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 px-5 py-2.5 rounded-xl flex items-center transition-all shadow-lg hover:shadow-xl active:scale-95 text-xs font-bold uppercase tracking-wider"
                        >
                            {viewMode === 'list' ? (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create New
                                </>
                            ) : (type === 'reel' || type === 'post') ? null : (
                                <>View All List</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                {/* CASE 1: No content found on account at all */}
                        {!hasAnyContent && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-gradient-to-tr from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                    <Ghost className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                                    {type === 'mention' ? "No Mentions Found" : `No ${type.charAt(0).toUpperCase() + type.slice(1)}s Found`}
                                </h3>
                                <div className="text-gray-500 dark:text-gray-400 max-w-lg leading-relaxed mb-8 text-sm font-medium">
                                    {type === 'story' ? (
                                        "Stories disappear after 24 hours. We only fetch currently active stories."
                                    ) : (
                                        `We couldn't find any recent ${type}s on your connected Instagram account.`
                                    )}
                                </div>

                                <button
                                    onClick={handleRefresh}
                                    disabled={cooldown > 0 || isRefreshing}
                                    className={`group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:shadow-2xl ${cooldown > 0 || isRefreshing
                                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:-translate-y-1 active:scale-95'
                                        }`}
                                >
                                    {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />}
                                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>
                        )}

                        {/* CASE 2: Content exists, but no automations -> CTA State */}
                        {hasAnyContent && !hasAnyAutomation && viewMode === 'list' && type !== 'mention' && (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                                    <div className="relative w-28 h-28 bg-white dark:bg-gray-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/10 border border-slate-200 dark:border-slate-700">
                                        <Inbox className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                                        <div className="absolute -top-2 -right-2 bg-black text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                                            {mediaItems.length}
                                        </div>
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 text-center">
                                    Ready to Automate
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 font-medium">
                                    {`You have ${mediaItems.length} ${type}s available. Select one to start setting up auto-replies and boost your engagement.`}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center px-4">
                                    <button
                                        onClick={() => setViewMode('create')}
                                        className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100 px-10 py-5 rounded-2xl flex items-center justify-center shadow-2xl transition-all hover:-translate-y-1 active:scale-95 font-bold text-sm uppercase tracking-wider"
                                    >
                                        <Plus className="w-5 h-5 mr-3" />
                                        Start First Automation
                                    </button>
                                    <button
                                        onClick={handleRefresh}
                                        disabled={cooldown > 0 || isRefreshing}
                                        className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-8 py-5 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 font-bold text-sm uppercase tracking-wider disabled:opacity-50"
                                    >
                                        <RefreshCcw className={`w-4 h-4 mr-3 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                                    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                            )}>
                                {automationsSet.map(item => (
                                    <Card
                                        key={item.id}
                                        onClick={() => onCreateAutomation(item)}
                                        className={cn(
                                            'group h-full cursor-pointer overflow-hidden border p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl',
                                            useShowcaseCards
                                                ? 'min-h-[23rem] rounded-[1.8rem] border-border bg-card shadow-sm'
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
                        {((viewMode === 'create' && hasAnyContent) || type === 'mention') && (
                            <div className="flex-1 min-h-[500px] relative">

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
                                                'grid gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto pr-2 max-h-[800px] scrollbar-thin',
                                                useShowcaseCards
                                                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
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
                                                                ? `min-h-[23rem] rounded-[1.8rem] border border-border bg-card p-0 shadow-sm ${isAutomated ? 'ring-2 ring-primary/20' : 'hover:ring-2 hover:ring-primary/20'}`
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
                                                                    <div className="px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-xl text-white text-[8px] font-black uppercase tracking-widest border border-white/10">
                                                                        {item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : item.media_type === 'VIDEO' ? 'Video' : 'Image'}
                                                                    </div>
                                                                    {isAutomated && (
                                                                        <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg">
                                                                            <Check className="w-3 h-3 stroke-[4]" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className={`absolute inset-0 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px] ${isAutomated ? 'bg-blue-900/40 opacity-100' : 'bg-black/60 opacity-0 group-hover:opacity-100'}`}>
                                                                    {isAutomated ? (
                                                                        <div className="flex flex-col items-center gap-3">
                                                                            <div className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2">
                                                                                <Pencil className="w-3.5 h-3.5" /> Edit Automation
                                                                            </div>
                                                                            <span className="text-[9px] font-black text-white/80 uppercase tracking-widest">Running Active</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-white text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transform scale-90 group-hover:scale-100 transition-all duration-300 shadow-2xl flex items-center gap-2">
                                                                            <Plus className="w-4 h-4" /> Setup Automation
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent group-hover:translate-y-full transition-transform duration-300">
                                                                    <div className="flex items-center gap-2 mb-1.5 opacity-80">
                                                                        <Calendar className="w-3 h-3 text-white" />
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-white">
                                                                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] line-clamp-2 font-bold text-white leading-snug">
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
