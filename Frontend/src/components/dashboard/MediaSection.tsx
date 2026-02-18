import React, { useEffect, useState, useRef, useCallback } from 'react';
import Card from '../ui/card';
import { Plus, RefreshCcw, Calendar, Search, Ghost, Inbox, Loader2, ChevronRight, Film, Image as ImageIcon, Pencil, Check, ChevronDown, X, AlertCircle } from 'lucide-react';
import ModernCalendar from '../ui/ModernCalendar';
import LoadingOverlay from '../ui/LoadingOverlay';
import { getApiCooldown, setApiTimestamp } from '../../utils/rateLimit';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';

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
    const { mediaCache, updateMediaCache, activeAccountID, refreshStats, automationInitialLoaded, setAutomationInitialLoaded } = useDashboard();
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

    return (
        <div className="bg-white dark:bg-black p-6 rounded-3xl h-full min-h-[500px] flex flex-col border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    {viewMode === 'create' && (type === 'reel' || type === 'post') && (
                        <button
                            onClick={() => setViewMode('list')}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Back to List
                        </button>
                    )}
                    <div>
                        <h2 className="text-3xl font-black text-black dark:text-white tracking-tight">{title}</h2>
                        {(type === 'story' || type === 'live') && (
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                {type === 'live' ? "Only active live broadcasts appear here" : "Showing active 24h stories"}
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
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm"
                                >
                                    <Calendar className={`w-3.5 h-3.5 ${mediaDateFilter !== 'all' ? 'text-blue-500' : 'text-slate-400'}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                        {mediaDateFilter === 'all' ? 'All Time' :
                                            mediaDateFilter === '7days' ? 'Last 7 Days' :
                                                mediaDateFilter === '30days' ? 'Last 30 Days' : 'Custom'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${dateDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {dateDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setDateDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[70] min-w-[160px] animate-in zoom-in-95 duration-200">
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
                                                    className={`w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${mediaDateFilter === f.id ? 'text-blue-600' : 'text-slate-500'}`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                            {mediaDateFilter === 'custom' && (
                                                <div className="mt-2 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
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
                                                        <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                                            <button
                                                                onClick={(e) => { e.preventDefault(); setDateDropdownOpen(false); }}
                                                                className="w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
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
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm"
                                >
                                    <RefreshCcw className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                        {sortOrder === 'recent' ? 'Recent' : 'Oldest'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${sortDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {sortDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setSortDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[70] min-w-[120px] animate-in zoom-in-95 duration-200">
                                            <button
                                                onClick={() => { setSortOrder('recent'); setSortDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${sortOrder === 'recent' ? 'text-blue-600' : 'text-slate-500'}`}
                                            >
                                                Recent
                                            </button>
                                            <button
                                                onClick={() => { setSortOrder('oldest'); setSortDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${sortOrder === 'oldest' ? 'text-blue-600' : 'text-slate-500'}`}
                                            >
                                                Oldest
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {type !== 'mention' && type !== 'story' && type !== 'live' && !(viewMode === 'create' && (type === 'reel' || type === 'post')) && hasAnyContent && (
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
                                    {type === 'live' ? "No Live Broadcast Detected" :
                                        type === 'mention' ? "No Mentions Found" :
                                            `No ${type.charAt(0).toUpperCase() + type.slice(1)}s Found`}
                                </h3>
                                <div className="text-gray-500 dark:text-gray-400 max-w-lg leading-relaxed mb-8 text-sm font-medium">
                                    {type === 'story' ? (
                                        "Stories disappear after 24 hours. We only fetch currently active stories."
                                    ) : type === 'live' ? (
                                        "You must be currently live for us to detect the broadcast. Start your live video on Instagram first."
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
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 text-center">Ready to Automate</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8 font-medium">
                                    You have {mediaItems.length} {type}s available. Select one to start setting up auto-replies and boost your engagement.
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
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {automationsSet.map(item => (
                                    <Card key={item.id} className="overflow-hidden p-0 border-0 group relative bg-gray-50 dark:bg-gray-900 shadow-lg hover:shadow-2xl rounded-3xl transition-all duration-500 hover:-translate-y-2">
                                        <div className={`relative overflow-hidden ${isVerticalType ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
                                            <img
                                                src={item.thumbnail_url || item.media_url}
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
                                                    onClick={() => onCreateAutomation(item)}
                                                    className="mt-2 px-5 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors shadow-lg"
                                                >
                                                    Manage
                                                </button>
                                            </div>
                                        </div>
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
                                                Note: Instagram allows fetching up to 10,000 recently created posts and reels via DM Panda.
                                            </p>
                                        </div>
                                        <div key={type + mediaDateFilter} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto pr-2 max-h-[800px] scrollbar-thin">
                                            {sortedItems.map((item) => {
                                                const isAutomated = item.has_automation;
                                                return (
                                                    <Card
                                                        key={item.id}
                                                        onClick={() => onCreateAutomation(item)}
                                                        className={`overflow-hidden p-0 border-0 group cursor-pointer transition-all bg-slate-50 dark:bg-slate-900 rounded-[2rem] relative shadow-md hover:shadow-2xl ${isAutomated ? 'ring-2 ring-blue-500/20' : 'hover:ring-4 ring-blue-500/30'}`}
                                                    >
                                                        <div className={`relative overflow-hidden ${isVerticalType ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
                                                            <img
                                                                src={item.thumbnail_url || item.media_url}
                                                                alt={item.caption || "Media"}
                                                                className={`object-cover w-full h-full transition-all duration-700 group-hover:scale-110 ${isAutomated ? 'grayscale hover:grayscale-0 brightness-[0.8] group-hover:brightness-100' : ''}`}
                                                                loading="lazy"
                                                            />

                                                            {/* Status Badge */}
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

                                                            {/* Hover Overlay */}
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

                                                            {/* Caption Footer */}
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
