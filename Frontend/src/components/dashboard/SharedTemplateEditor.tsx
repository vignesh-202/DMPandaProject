import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    FileText, Smartphone, Image as ImageIcon, Reply, MousePointerClick, Share2,
    Plus, Trash2, AlertCircle, Calendar, ChevronDown, Check, RefreshCw, Film, Globe, Loader2, X, CheckCircle2, Info
} from 'lucide-react';
import ModernCalendar from '../ui/ModernCalendar';
import {
    getByteLength,
    TEXT_MAX,
    BUTTON_TEXT_MAX,
    BUTTON_TITLE_MAX,
    CAROUSEL_TITLE_MAX,
    CAROUSEL_SUBTITLE_MAX,
    CAROUSEL_ELEMENTS_MAX,
    BUTTONS_MAX,
    QUICK_REPLIES_MAX,
    QUICK_REPLY_TITLE_MAX,
    QUICK_REPLY_PAYLOAD_MAX,
    QUICK_REPLIES_TEXT_MAX,
} from '../../lib/templateLimits';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';

export type TemplateType = 'template_text' | 'template_carousel' | 'template_buttons' | 'template_media' | 'template_share_post' | 'template_quick_replies';

export interface TemplateData {
    text?: string;
    elements?: Array<{
        title: string;
        subtitle?: string;
        image_url: string;
        buttons?: Array<{ title: string; url: string; type: string }>;
    }>;
    buttons?: Array<{ title: string; url: string; type: string }>;
    media_url?: string;
    thumbnail_url?: string;
    preview_media_url?: string;
    media_id?: string;
    replies?: Array<{ title: string; payload: string; content_type?: string }>;
    caption?: string;
    linked_media_url?: string;
    media_type?: string;
    permalink?: string;
    use_latest_post?: boolean;
    latest_post_type?: 'post' | 'reel';
}

export interface SharedTemplateEditorProps {
    templateType: TemplateType;
    templateData: TemplateData;
    validationErrors: { [key: string]: string };
    activeAccountID?: string;
    authenticatedFetch?: any;
    onUpdate: (data: TemplateData) => void;
    onValidationErrorChange?: (errors: { [key: string]: string }) => void;
    activeCarouselElementIdx?: number;
    onActiveCarouselElementChange?: (idx: number) => void;
    sharePostContentType?: 'all' | 'posts' | 'reels';
    onSharePostContentTypeChange?: (type: 'all' | 'posts' | 'reels') => void;
    sharePostDateRange?: 'all' | '7days' | '30days' | '90days' | 'custom';
    onSharePostDateRangeChange?: (range: 'all' | '7days' | '30days' | '90days' | 'custom') => void;
    sharePostSortBy?: 'recent' | 'oldest';
    onSharePostSortByChange?: (sort: 'recent' | 'oldest') => void;
    sharePostCustomRange?: { from: Date | null; to: Date | null };
    onSharePostCustomRangeChange?: (range: { from: Date | null; to: Date | null }) => void;
}

// Coalesce duplicate share-post media fetches across strict-mode re-mounts
let sharedSharePostMediaPromise: Promise<any[]> | null = null;
let sharedSharePostMediaKey = '';

const SharedTemplateEditor: React.FC<SharedTemplateEditorProps> = ({
    templateType,
    templateData,
    validationErrors,
    activeAccountID,
    authenticatedFetch,
    onUpdate,
    onValidationErrorChange,
    activeCarouselElementIdx: externalActiveCarouselElementIdx,
    onActiveCarouselElementChange,
    sharePostContentType: externalSharePostContentType,
    onSharePostContentTypeChange,
    sharePostDateRange: externalSharePostDateRange,
    onSharePostDateRangeChange,
    sharePostSortBy: externalSharePostSortBy,
    onSharePostSortByChange,
    sharePostCustomRange: externalSharePostCustomRange,
    onSharePostCustomRangeChange,
}) => {
    const [localActiveCarouselElementIdx, setLocalActiveCarouselElementIdx] = useState(0);
    const activeCarouselElementIdx = externalActiveCarouselElementIdx !== undefined ? externalActiveCarouselElementIdx : localActiveCarouselElementIdx;
    const setActiveCarouselElementIdx = onActiveCarouselElementChange || setLocalActiveCarouselElementIdx;

    const [localSharePostContentType, setLocalSharePostContentType] = useState<'all' | 'posts' | 'reels'>('all');
    const sharePostContentType = externalSharePostContentType !== undefined ? externalSharePostContentType : localSharePostContentType;
    const setSharePostContentType = onSharePostContentTypeChange || setLocalSharePostContentType;

    const [localSharePostDateRange, setLocalSharePostDateRange] = useState<'all' | '7days' | '30days' | '90days' | 'custom'>('all');
    const sharePostDateRange = externalSharePostDateRange !== undefined ? externalSharePostDateRange : localSharePostDateRange;
    const setSharePostDateRange = onSharePostDateRangeChange || setLocalSharePostDateRange;

    const [localSharePostSortBy, setLocalSharePostSortBy] = useState<'recent' | 'oldest'>('recent');
    const sharePostSortBy = externalSharePostSortBy !== undefined ? externalSharePostSortBy : localSharePostSortBy;
    const setSharePostSortBy = onSharePostSortByChange || setLocalSharePostSortBy;

    const [localSharePostCustomRange, setLocalSharePostCustomRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
    const sharePostCustomRange = externalSharePostCustomRange !== undefined ? externalSharePostCustomRange : localSharePostCustomRange;
    const setSharePostCustomRange = onSharePostCustomRangeChange || setLocalSharePostCustomRange;

    const [sharePostMedia, setSharePostMedia] = useState<any[]>([]);
    const [isFetchingMedia, setIsFetchingMedia] = useState(false);
    const [mediaDateDropdownOpen, setMediaDateDropdownOpen] = useState(false);
    const [mediaSortDropdownOpen, setMediaSortDropdownOpen] = useState(false);
    const mediaDateDropdownRef = useRef<HTMLDivElement | null>(null);
    const mediaSortDropdownRef = useRef<HTMLDivElement | null>(null);
    const mediaGridRef = useRef<HTMLDivElement | null>(null);

    // Fetch media for share post template
    const fetchSharePostMedia = useCallback(async (force = false) => {
        if (!activeAccountID || !authenticatedFetch) return;
        const params = new URLSearchParams({
            account_id: activeAccountID,
            type: sharePostContentType === 'all' ? 'all' : sharePostContentType,
            limit: '100'
        });
        if (sharePostDateRange !== 'all') {
            const until = Math.floor(Date.now() / 1000);
            let since = 0;
            if (sharePostDateRange === '7days') since = until - (7 * 24 * 60 * 60);
            else if (sharePostDateRange === '30days') since = until - (30 * 24 * 60 * 60);
            else if (sharePostDateRange === '90days') since = until - (90 * 24 * 60 * 60);
            else if (sharePostDateRange === 'custom' && sharePostCustomRange.from) {
                since = Math.floor(sharePostCustomRange.from.getTime() / 1000);
                if (sharePostCustomRange.to) {
                    const endTs = Math.floor(sharePostCustomRange.to.getTime() / 1000) + (24 * 60 * 60) - 1;
                    params.append('until', endTs.toString());
                }
            }
            if (since > 0) params.append('since', since.toString());
            if (sharePostDateRange !== 'custom') params.append('until', until.toString());
        }

        const requestKey = `${activeAccountID}|${params.toString()}`;
        const doFetch = async () => {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?${params}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
            return [];
        };

        let promise: Promise<any[]>;
        if (!force && sharedSharePostMediaPromise && sharedSharePostMediaKey === requestKey) {
            promise = sharedSharePostMediaPromise;
        } else {
            sharedSharePostMediaKey = requestKey;
            promise = doFetch();
            if (!force) {
                sharedSharePostMediaPromise = promise;
            }
        }

        setIsFetchingMedia(true);
        try {
            const media = await promise;
            setSharePostMedia(media);
        } catch (err) {
            console.error('Failed to fetch media:', err);
        } finally {
            if (!force && sharedSharePostMediaPromise === promise) {
                sharedSharePostMediaPromise = null;
            }
            setIsFetchingMedia(false);
        }
    }, [activeAccountID, authenticatedFetch, sharePostContentType, sharePostDateRange, sharePostCustomRange]);

    useEffect(() => {
        if (templateType === 'template_share_post' && activeAccountID) {
            fetchSharePostMedia();
        }
    }, [templateType, activeAccountID, sharePostDateRange, sharePostCustomRange, fetchSharePostMedia]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;

            if (mediaDateDropdownRef.current && !mediaDateDropdownRef.current.contains(target)) {
                setMediaDateDropdownOpen(false);
            }

            if (mediaSortDropdownRef.current && !mediaSortDropdownRef.current.contains(target)) {
                setMediaSortDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, []);

    const forwardPopupWheelToMediaGrid = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (!mediaGridRef.current) return;
        event.preventDefault();
        mediaGridRef.current.scrollTop += event.deltaY;
    }, []);

    const filteredSharePostMedia = sharePostContentType === 'all' ? sharePostMedia :
        sharePostMedia.filter(m => sharePostContentType === 'posts' ?
            (m.media_product_type === 'FEED' || m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM') :
            (m.media_product_type === 'REELS' || (m.media_type === 'VIDEO' && m.media_product_type !== 'FEED'))
        );

    const latestSharePostPreviewMedia = useMemo(() => {
        const targetType = templateData.latest_post_type === 'reel' ? 'reel' : 'post';
        return [...sharePostMedia]
            .filter((media) => (
                targetType === 'reel'
                    ? media.media_type === 'VIDEO'
                    : media.media_type !== 'VIDEO'
            ))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
    }, [sharePostMedia, templateData.latest_post_type]);

    useEffect(() => {
        if (templateType !== 'template_share_post' || !templateData.use_latest_post) return;

        const previewUrl = latestSharePostPreviewMedia?.thumbnail_url || latestSharePostPreviewMedia?.media_url || '';
        const mediaUrl = latestSharePostPreviewMedia?.media_url || previewUrl;
        const linkedMediaUrl = latestSharePostPreviewMedia?.media_url || '';
        const nextLatestType = templateData.latest_post_type || 'post';

        const hasChanged =
            (templateData.media_url || '') !== mediaUrl ||
            (templateData.thumbnail_url || '') !== previewUrl ||
            (templateData.preview_media_url || '') !== previewUrl ||
            (templateData.linked_media_url || '') !== linkedMediaUrl ||
            (templateData.caption || '') !== String(latestSharePostPreviewMedia?.caption || '') ||
            (templateData.media_type || '') !== String(latestSharePostPreviewMedia?.media_type || '') ||
            (templateData.permalink || '') !== String(latestSharePostPreviewMedia?.permalink || '') ||
            (templateData.latest_post_type || 'post') !== nextLatestType;

        if (!hasChanged) return;

        onUpdate({
            ...templateData,
            media_url: mediaUrl,
            thumbnail_url: previewUrl || undefined,
            preview_media_url: previewUrl || undefined,
            linked_media_url: linkedMediaUrl || undefined,
            caption: latestSharePostPreviewMedia?.caption || '',
            media_type: latestSharePostPreviewMedia?.media_type || '',
            permalink: latestSharePostPreviewMedia?.permalink || '',
            latest_post_type: nextLatestType
        });
    }, [
        latestSharePostPreviewMedia,
        onUpdate,
        templateData.caption,
        templateData.latest_post_type,
        templateData.linked_media_url,
        templateData.media_type,
        templateData.media_url,
        templateData.permalink,
        templateData.preview_media_url,
        templateData.thumbnail_url,
        templateData.use_latest_post,
        templateType
    ]);

    const clearValidationError = (key: string) => {
        if (onValidationErrorChange && validationErrors[key]) {
            const newErrors = { ...validationErrors };
            delete newErrors[key];
            onValidationErrorChange(newErrors);
        }
    };

    const renderTextTemplate = () => (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-content space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reply Message</label>
                <span className={`text-[9px] font-bold ${getByteLength(templateData.text || '') > TEXT_MAX ? 'text-red-500' : 'text-gray-400'}`}>
                    {getByteLength(templateData.text || '')}/1000 bytes
                </span>
            </div>
            <textarea
                id="field_template_text"
                value={templateData.text || ''}
                onChange={(e) => {
                    const val = e.target.value;
                    if (getByteLength(val) <= TEXT_MAX) {
                        onUpdate({ ...templateData, text: val });
                        clearValidationError('template_text');
                    }
                }}
                className={`w-full bg-white dark:bg-gray-900 border-2 ${validationErrors['template_text'] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} focus:border-blue-500/50 outline-none rounded-2xl p-6 text-sm font-bold text-gray-900 dark:text-gray-100 min-h-[160px] shadow-xl shadow-black/5 transition-all resize-none`}
                placeholder="Enter your reply message here..."
            />
            {validationErrors['template_text'] && (
                <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {validationErrors['template_text']}
                </p>
            )}
        </div>
    );

    const renderCarouselTemplate = () => {
        const elements = templateData.elements || [];
        const activeElement = elements[activeCarouselElementIdx] || null;

        return (
            <div className="space-y-6">
                {/* Element Tabs */}
                <div className="flex flex-wrap items-center gap-3 pb-4 px-1">
                    {elements.map((_: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => setActiveCarouselElementIdx(idx)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${activeCarouselElementIdx === idx
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30'
                                : 'bg-white dark:bg-gray-900 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border border-content'
                                }`}
                        >
                            Item {idx + 1}
                            {elements.length > 1 && activeCarouselElementIdx === idx && (
                                <Trash2
                                    className="w-3 h-3 text-white/70 hover:text-white transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newElements = [...elements];
                                        newElements.splice(idx, 1);
                                        onUpdate({ ...templateData, elements: newElements });
                                        if (activeCarouselElementIdx >= newElements.length) {
                                            setActiveCarouselElementIdx(Math.max(0, newElements.length - 1));
                                        }
                                    }}
                                />
                            )}
                        </button>
                    ))}
                    {elements.length < CAROUSEL_ELEMENTS_MAX && (
                        <button
                            onClick={() => {
                                const newElements = [...elements, {
                                    title: '',
                                    subtitle: '',
                                    image_url: '',
                                    buttons: [{ title: '', url: '', type: 'web_url' }]
                                }];
                                onUpdate({ ...templateData, elements: newElements });
                                setActiveCarouselElementIdx(newElements.length - 1);
                            }}
                            className="px-5 py-2.5 rounded-2xl bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 border border-blue-500/20 shrink-0 flex items-center justify-center transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Active Element Editor - Exact match with InboxMenu */}
                {activeElement && (() => {
                    return (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-8 rounded-2xl border border-content space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Headline</label>
                                            <span className={`text-[8px] font-bold ${getByteLength(activeElement.title || '') > CAROUSEL_TITLE_MAX ? 'text-red-500' : 'text-gray-400'}`}>
                                                {getByteLength(activeElement.title || '')}/80 bytes
                                            </span>
                                        </div>
                                        <input
                                            id={`field_element_${activeCarouselElementIdx}_title`}
                                            value={activeElement.title || ''}
                                            onChange={e => {
                                                const elements = [...(templateData.elements || [])];
                                                elements[activeCarouselElementIdx].title = e.target.value;
                                                onUpdate({ ...templateData, elements });
                                                if (validationErrors[`element_${activeCarouselElementIdx}_title`]) {
                                                    const newErr = { ...validationErrors };
                                                    delete newErr[`element_${activeCarouselElementIdx}_title`];
                                                    if (onValidationErrorChange) onValidationErrorChange(newErr);
                                                }
                                            }}
                                            className={`w-full bg-white dark:bg-gray-900 border-2 ${validationErrors[`element_${activeCarouselElementIdx}_title`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} focus:border-blue-500 dark:focus:border-blue-400 outline-none rounded-2xl p-4 text-xs font-bold text-gray-900 dark:text-gray-100 shadow-sm`}
                                            placeholder="Premium Panda Pack"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Description <span className="text-gray-300 dark:text-gray-600">(Optional)</span></label>
                                            <span className={`text-[8px] font-bold ${getByteLength(activeElement.subtitle || '') > CAROUSEL_SUBTITLE_MAX ? 'text-red-500' : 'text-gray-400'}`}>
                                                {getByteLength(activeElement.subtitle || '')}/80 bytes
                                            </span>
                                        </div>
                                        <textarea
                                            value={activeElement.subtitle || ''}
                                            onChange={e => {
                                                const elements = [...(templateData.elements || [])];
                                                elements[activeCarouselElementIdx].subtitle = e.target.value;
                                                onUpdate({ ...templateData, elements });
                                            }}
                                            className="w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none rounded-2xl p-4 text-xs font-bold text-gray-900 dark:text-gray-100 min-h-[100px] shadow-sm"
                                            placeholder="Get the best of DMPanda today..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Visual Asset Preview & Image URL</label>
                                        <div className={`aspect-video relative rounded-2xl overflow-hidden border-2 ${validationErrors[`element_${activeCarouselElementIdx}_image`] ? 'border-red-500' : 'border-dashed border-gray-200 dark:border-gray-800'} bg-white dark:bg-gray-900 group`}>
                                            {activeElement.image_url ? (
                                                <>
                                                    <img src={activeElement.image_url} className="w-full h-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button onClick={() => {
                                                            const elements = [...(templateData.elements || [])];
                                                            elements[activeCarouselElementIdx].image_url = '';
                                                            onUpdate({ ...templateData, elements });
                                                        }} className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-xl text-white backdrop-blur-md transition-all">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-gray-400">
                                                    <ImageIcon className="w-8 h-8" />
                                                    <span className="text-[9px] font-black uppercase">No Image Set</span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            id={`field_element_${activeCarouselElementIdx}_image`}
                                            value={activeElement.image_url || ''}
                                            onChange={e => {
                                                const elements = [...(templateData.elements || [])];
                                                elements[activeCarouselElementIdx].image_url = e.target.value;
                                                onUpdate({ ...templateData, elements });
                                                if (validationErrors[`element_${activeCarouselElementIdx}_image`]) {
                                                    const newErr = { ...validationErrors };
                                                    delete newErr[`element_${activeCarouselElementIdx}_image`];
                                                    if (onValidationErrorChange) onValidationErrorChange(newErr);
                                                }
                                            }}
                                            className={`w-full bg-white dark:bg-gray-900 border-2 ${validationErrors[`element_${activeCarouselElementIdx}_image`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} focus:border-blue-500 dark:focus:border-blue-400 outline-none rounded-xl py-3 px-4 text-[10px] font-bold text-gray-900 dark:text-gray-100 shadow-sm`}
                                            placeholder="Paste high-res image URL here..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Buttons Configuration - Exact match with InboxMenu */}
                            <div className="pt-8 border-t border-content space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Buttons Configuration <span className="text-gray-300 dark:text-gray-600">(Optional - Max 3)</span></h4>
                                    <button
                                        onClick={() => {
                                            const elements = [...(templateData.elements || [])];
                                            if (!elements[activeCarouselElementIdx].buttons) elements[activeCarouselElementIdx].buttons = [];
                                            if (elements[activeCarouselElementIdx].buttons!.length < 3) {
                                                elements[activeCarouselElementIdx].buttons!.push({ title: '', url: '', type: 'web_url' });
                                                onUpdate({ ...templateData, elements });
                                            }
                                        }}
                                        disabled={(activeElement.buttons || []).length >= 3}
                                        className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 disabled:opacity-20"
                                    >
                                        + Add Button
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {(activeElement.buttons || []).map((btn: any, bidx: number) => (
                                        <div key={bidx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-content">
                                            <div className="md:col-span-4 space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Button Title</label>
                                                    <span className={`text-[8px] font-bold ${getByteLength(btn.title || '') > 40 ? 'text-red-500' : 'text-gray-300'}`}>
                                                        {getByteLength(btn.title || '')}/40 bytes
                                                    </span>
                                                </div>
                                                <input
                                                    id={`field_element_${activeCarouselElementIdx}_btn_${bidx}_title`}
                                                    value={btn.title || ''}
                                                    onChange={e => {
                                                        const elements = [...(templateData.elements || [])];
                                                        if (elements[activeCarouselElementIdx].buttons) {
                                                            elements[activeCarouselElementIdx].buttons![bidx].title = e.target.value;
                                                            onUpdate({ ...templateData, elements });
                                                        }
                                                        if (validationErrors[`element_${activeCarouselElementIdx}_btn_${bidx}_title`]) {
                                                            const newErr = { ...validationErrors };
                                                            delete newErr[`element_${activeCarouselElementIdx}_btn_${bidx}_title`];
                                                            if (onValidationErrorChange) onValidationErrorChange(newErr);
                                                        }
                                                    }}
                                                    className={`w-full bg-gray-50 dark:bg-gray-800 border-2 ${validationErrors[`element_${activeCarouselElementIdx}_btn_${bidx}_title`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-xl p-3 text-[11px] font-black text-gray-900 dark:text-gray-100 shadow-inner focus:border-blue-500 dark:focus:border-blue-400 transition-all`}
                                                    placeholder="Buy Now"
                                                />
                                            </div>
                                            <div className="md:col-span-7 space-y-1.5">
                                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Button Action (Link)</label>
                                                <input
                                                    id={`field_element_${activeCarouselElementIdx}_btn_${bidx}_url`}
                                                    value={btn.url || ''}
                                                    onChange={e => {
                                                        const elements = [...(templateData.elements || [])];
                                                        if (elements[activeCarouselElementIdx].buttons) {
                                                            elements[activeCarouselElementIdx].buttons![bidx].url = e.target.value;
                                                            onUpdate({ ...templateData, elements });
                                                        }
                                                        if (validationErrors[`element_${activeCarouselElementIdx}_btn_${bidx}_url`]) {
                                                            const newErr = { ...validationErrors };
                                                            delete newErr[`element_${activeCarouselElementIdx}_btn_${bidx}_url`];
                                                            if (onValidationErrorChange) onValidationErrorChange(newErr);
                                                        }
                                                    }}
                                                    className={`w-full bg-gray-50 dark:bg-gray-800 border-2 ${validationErrors[`element_${activeCarouselElementIdx}_btn_${bidx}_url`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'} rounded-xl p-3 text-[11px] font-bold text-gray-900 dark:text-gray-100 shadow-inner focus:border-blue-500 dark:focus:border-blue-400 transition-all`}
                                                    placeholder="https://..."
                                                />
                                                {validationErrors[`element_${activeCarouselElementIdx}_btn_${bidx}_url`] && (
                                                    <p className="text-[8px] font-bold text-red-500 px-1">{validationErrors[`element_${activeCarouselElementIdx}_btn_${bidx}_url`]}</p>
                                                )}
                                            </div>
                                            <div className="md:col-span-1 pb-1">
                                                {(activeElement.buttons || []).length > 1 && (
                                                    <button
                                                        onClick={() => {
                                                            const elements = [...(templateData.elements || [])];
                                                            if (elements[activeCarouselElementIdx].buttons) {
                                                                elements[activeCarouselElementIdx].buttons!.splice(bidx, 1);
                                                                onUpdate({ ...templateData, elements });
                                                            }
                                                        }}
                                                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };

    const renderButtonsTemplate = () => (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-8 rounded-2xl border border-content space-y-8">
            <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Message Content</label>
                    <span className={`text-[8px] font-bold ${getByteLength(templateData.text || '') > 640 ? 'text-red-500' : 'text-gray-400'}`}>
                        {getByteLength(templateData.text || '')}/640 bytes
                    </span>
                </div>
                <textarea
                    id="field_button_text"
                    value={templateData.text || ''}
                    onChange={e => {
                        const val = e.target.value;
                        if (getByteLength(val) <= 640) {
                            onUpdate({ ...templateData, text: val });
                            clearValidationError('button_text');
                        }
                    }}
                    className={`w-full bg-white dark:bg-gray-900 border-2 ${validationErrors['button_text'] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} focus:border-blue-500/50 outline-none rounded-2xl p-6 text-xs font-bold text-gray-900 dark:text-gray-100 min-h-[120px] shadow-xl shadow-black/5 transition-all resize-none`}
                    placeholder="Enter your message here..."
                />
                {validationErrors['button_text'] && (
                    <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {validationErrors['button_text']}
                    </p>
                )}
            </div>

            <div className="pt-8 border-t border-content space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Buttons (Max 3)</h4>
                    <button
                        onClick={() => {
                            const buttons = [...(templateData.buttons || [])];
                            if (buttons.length < 3) {
                                buttons.push({ title: '', url: '', type: 'web_url' });
                                onUpdate({ ...templateData, buttons });
                            }
                        }}
                        disabled={(templateData.buttons || []).length >= 3}
                        className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 disabled:opacity-20"
                    >
                        + Add Button
                    </button>
                </div>
                <div className="space-y-4">
                    {(templateData.buttons || []).map((btn: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-content">
                            <div className="md:col-span-4 space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Button Title</label>
                                    <span className={`text-[8px] font-bold ${getByteLength(btn.title || '') > 40 ? 'text-red-500' : 'text-gray-300'}`}>
                                        {getByteLength(btn.title || '')}/40 bytes
                                    </span>
                                </div>
                                <input
                                    id={`field_btn_${idx}_title`}
                                    value={btn.title || ''}
                                    onChange={e => {
                                        const buttons = [...(templateData.buttons || [])];
                                        buttons[idx].title = e.target.value;
                                        onUpdate({ ...templateData, buttons });
                                        clearValidationError(`btn_${idx}_title`);
                                    }}
                                    className={`w-full bg-gray-50 dark:bg-black/30 border-2 ${validationErrors[`btn_${idx}_title`] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-3 text-[11px] font-black text-gray-900 dark:text-gray-100 shadow-inner focus:border-blue-500/50 transition-all`}
                                    placeholder="Button Text"
                                />
                            </div>
                            <div className="md:col-span-7 space-y-1.5">
                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Button Link</label>
                                <input
                                    id={`field_btn_${idx}_url`}
                                    value={btn.url || ''}
                                    onChange={e => {
                                        const buttons = [...(templateData.buttons || [])];
                                        buttons[idx].url = e.target.value;
                                        onUpdate({ ...templateData, buttons });
                                        clearValidationError(`btn_${idx}_url`);
                                    }}
                                    className={`w-full bg-gray-50 dark:bg-black/30 border-2 ${validationErrors[`btn_${idx}_url`] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-3 text-[11px] font-bold text-gray-900 dark:text-gray-100 shadow-inner focus:border-blue-500/50 transition-all`}
                                    placeholder="https://..."
                                />
                                {validationErrors[`btn_${idx}_url`] && (
                                    <p className="text-[8px] font-bold text-red-500 px-1">{validationErrors[`btn_${idx}_url`]}</p>
                                )}
                            </div>
                            <div className="md:col-span-1 pb-1">
                                {(templateData.buttons || []).length > 1 && (
                                    <button
                                        onClick={() => {
                                            const buttons = (templateData.buttons || []).filter((_: any, i: number) => i !== idx);
                                            onUpdate({ ...templateData, buttons });
                                        }}
                                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderMediaTemplate = () => (
        <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-content space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Media URL</label>
                    </div>
                    <div className="relative">
                        <input
                            id="field_media_url"
                            value={templateData.media_url || ''}
                            onChange={e => {
                                onUpdate({ ...templateData, media_url: e.target.value });
                                clearValidationError('media_url');
                            }}
                            className={`w-full bg-white dark:bg-gray-900 border-2 ${validationErrors['media_url'] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} focus:border-blue-500/50 outline-none rounded-2xl p-4 text-xs font-bold text-gray-900 dark:text-gray-100 shadow-xl shadow-black/5 transition-all`}
                            placeholder="Enter image URL..."
                        />
                    </div>
                    {validationErrors['media_url'] && (
                        <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {validationErrors['media_url']}
                        </p>
                    )}
                </div>

                {/* Preview - Exact match with InboxMenu */}
                {templateData.media_url && (
                    <div className="aspect-video relative rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <img src={toBrowserPreviewUrl(templateData.media_url || '')} className="w-full h-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                    </div>
                )}
            </div>
        </div>
    );

    const renderSharePostTemplate = () => {
        const sortedMedia = [...filteredSharePostMedia].sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return sharePostSortBy === 'recent' ? dateB - dateA : dateA - dateB;
        });

        return (
            <div className="space-y-6 animate-in zoom-in-95">
                <div id="field_media_id" className="bg-gray-50 dark:bg-black/40 p-8 rounded-[32px] border border-content space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select Media to Share</h3>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-content">
                                <button
                                    onClick={(e) => { e.preventDefault(); setSharePostContentType('posts'); }}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${sharePostContentType === 'posts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    Posts
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); setSharePostContentType('reels'); }}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${sharePostContentType === 'reels' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <Film className="w-3.5 h-3.5" />
                                    Reels
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); setSharePostContentType('all'); }}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${sharePostContentType === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <Globe className="w-3.5 h-3.5" />
                                    All
                                </button>
                                <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-2" />
                                <button
                                    onClick={(e) => { e.preventDefault(); fetchSharePostMedia(); }}
                                    disabled={isFetchingMedia}
                                    className="px-4 py-2 text-gray-400 hover:text-blue-500 rounded-xl transition-all disabled:opacity-50 group"
                                    title="Refresh media"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isFetchingMedia ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Latest Post/Reel Option */}
                    <div className={`flex items-center justify-between rounded-[28px] border border-content/70 bg-muted/40 p-5 ${templateData.use_latest_post ? 'ring-1 ring-primary/15' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-blue-50 dark:border-blue-500/10">
                                <Share2 className={`w-5 h-5 transition-colors ${templateData.use_latest_post ? 'text-blue-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.15em] mb-0.5">Use Latest Post/Reel</p>
                                <p className="text-[10px] font-medium text-gray-400">Send the latest post or reel at reply time</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={templateData.use_latest_post || false}
                                    onChange={(e) => {
                                        onUpdate({
                                            ...templateData,
                                            use_latest_post: e.target.checked,
                                            media_id: e.target.checked ? '' : templateData.media_id,
                                            latest_post_type: e.target.checked ? (templateData.latest_post_type || 'post') : undefined
                                        });
                                    }}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {templateData.use_latest_post && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Latest Content Type</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'post', icon: ImageIcon, label: 'Latest Post' },
                                    { id: 'reel', icon: Film, label: 'Latest Reel' },
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => onUpdate({ ...templateData, latest_post_type: t.id as 'post' | 'reel' })}
                                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${templateData.latest_post_type === t.id
                                            ? 'border-blue-500 bg-blue-500/5 text-blue-500'
                                            : 'border-transparent bg-gray-50 dark:bg-gray-900 text-gray-400'
                                            }`}
                                    >
                                        <t.icon className="w-5 h-5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!templateData.use_latest_post && (
                        <>
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/50 rounded-3xl border border-content shadow-sm relative z-50">
                                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                        <div ref={mediaDateDropdownRef} className="relative w-full sm:w-64">
                                            <button
                                                onClick={(e) => { e.preventDefault(); setMediaDateDropdownOpen(!mediaDateDropdownOpen); setMediaSortDropdownOpen(false); }}
                                                className="group flex w-full items-center justify-between rounded-2xl border border-border/80 bg-background/90 px-5 py-3 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.7)] transition-all hover:border-primary/35 hover:bg-card"
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <Calendar className={`w-4 h-4 shrink-0 ${sharePostDateRange !== 'all' ? 'text-primary' : 'text-muted-foreground/60'} transition-colors group-hover:text-primary`} />
                                                    <div className="flex flex-col items-start overflow-hidden">
                                                        <span className="truncate text-[10px] font-black uppercase tracking-widest text-foreground">
                                                            {sharePostDateRange === 'all' ? 'All Time' :
                                                                sharePostDateRange === '7days' ? 'Last 7 Days' :
                                                                    sharePostDateRange === '30days' ? 'Last 30 Days' :
                                                                        sharePostDateRange === '90days' ? 'Last 90 Days' : 'Custom Range'}
                                                        </span>
                                                        {sharePostDateRange === 'custom' && sharePostCustomRange.from && (
                                                            <span className="truncate text-[8px] font-bold uppercase tracking-tighter text-primary">
                                                                {sharePostCustomRange.from.toLocaleDateString()} {sharePostCustomRange.to ? `to ${sharePostCustomRange.to.toLocaleDateString()}` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/80 transition-colors group-hover:border-primary/35">
                                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${mediaDateDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
                                                </span>
                                            </button>

                                            {mediaDateDropdownOpen && (
                                                    <div
                                                        onWheel={forwardPopupWheelToMediaGrid}
                                                        className="absolute top-full left-0 right-0 z-20 mt-2 overflow-hidden rounded-[28px] border border-border/80 bg-card/98 p-2 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl animate-in zoom-in-95 duration-200"
                                                    >
                                                        {[
                                                            { id: 'all', label: 'All Time', icon: <Calendar className="w-3.5 h-3.5" /> },
                                                            { id: '7days', label: 'Last 7 Days', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                                                            { id: '30days', label: 'Last 30 Days', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                                                            { id: '90days', label: 'Last 90 Days', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                                                            { id: 'custom', label: 'Custom Range', icon: <Plus className="w-3.5 h-3.5" /> }
                                                        ].map((filter) => (
                                                            <button
                                                                key={filter.id}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setSharePostDateRange(filter.id as any);
                                                                    if (filter.id !== 'custom') setMediaDateDropdownOpen(false);
                                                                }}
                                                                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-all ${sharePostDateRange === filter.id
                                                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                                                    : 'text-foreground hover:bg-background/80 hover:text-primary'}`}
                                                            >
                                                                {filter.icon}
                                                                {filter.label}
                                                            </button>
                                                        ))}

                                                        {sharePostDateRange === 'custom' && (
                                                            <div className="mt-2 rounded-2xl border border-border/70 bg-background/80 p-4 animate-in slide-in-from-top-2">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="space-y-2">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">From</label>
                                                                        <input
                                                                            type="date"
                                                                            value={sharePostCustomRange.from ? sharePostCustomRange.from.toISOString().split('T')[0] : ''}
                                                                            onChange={(e) => {
                                                                                const newRange = { ...sharePostCustomRange, from: e.target.value ? new Date(e.target.value) : null };
                                                                                setSharePostCustomRange(newRange);
                                                                            }}
                                                                            className="w-full rounded-xl border border-border bg-input p-2.5 text-xs font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">To</label>
                                                                        <input
                                                                            type="date"
                                                                            value={sharePostCustomRange.to ? sharePostCustomRange.to.toISOString().split('T')[0] : ''}
                                                                            onChange={(e) => {
                                                                                const newRange = { ...sharePostCustomRange, to: e.target.value ? new Date(e.target.value) : null };
                                                                                setSharePostCustomRange(newRange);
                                                                            }}
                                                                            className="w-full rounded-xl border border-border bg-input p-2.5 text-xs font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => setMediaDateDropdownOpen(false)}
                                                                    className="mt-3 w-full rounded-xl bg-primary py-2 text-[10px] font-black uppercase text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                                                                >
                                                                    Apply
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                            )}
                                        </div>

                                        <div ref={mediaSortDropdownRef} className="relative w-full sm:w-48">
                                            <button
                                                onClick={(e) => { e.preventDefault(); setMediaSortDropdownOpen(!mediaSortDropdownOpen); setMediaDateDropdownOpen(false); }}
                                                className="group flex w-full items-center justify-between rounded-2xl border border-border/80 bg-background/90 px-5 py-3 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.7)] transition-all hover:border-primary/35 hover:bg-card"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <RefreshCw className="w-4 h-4 text-muted-foreground/60 transition-transform duration-500 group-hover:rotate-180 group-hover:text-primary" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                                        {sharePostSortBy === 'recent' ? 'Most Recent' : 'Oldest First'}
                                                    </span>
                                                </div>
                                                <span className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/80 transition-colors group-hover:border-primary/35">
                                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${mediaSortDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
                                                </span>
                                            </button>

                                            {mediaSortDropdownOpen && (
                                                    <div
                                                        onWheel={forwardPopupWheelToMediaGrid}
                                                        className="absolute top-full left-0 right-0 z-20 mt-2 overflow-hidden rounded-[28px] border border-border/80 bg-card/98 p-2 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl animate-in zoom-in-95 duration-200"
                                                    >
                                                        {[
                                                            { id: 'recent', label: 'Most Recent' },
                                                            { id: 'oldest', label: 'Oldest First' }
                                                        ].map((option) => (
                                                            <button
                                                                key={option.id}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setSharePostSortBy(option.id as any);
                                                                    setMediaSortDropdownOpen(false);
                                                                }}
                                                                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-all ${sharePostSortBy === option.id
                                                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                                                    : 'text-foreground hover:bg-background/80 hover:text-primary'}`}
                                                            >
                                                                {option.id === 'recent' ? <RefreshCw className="w-3.5 h-3.5 rotate-180" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {isFetchingMedia && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border border-content">
                                            {sharePostContentType === 'posts' ? 'Feed Posts' : sharePostContentType === 'reels' ? 'Reels Library' : 'All Media'}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content Area - Exact match with InboxMenu */}
                                <div className="flex-1 min-h-[400px] relative">
                                    {isFetchingMedia && !filteredSharePostMedia.length ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching your content...</p>
                                        </div>
                                    ) : !filteredSharePostMedia.length ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center text-slate-300">
                                                {sharePostContentType === 'reels' ? <Film className="w-8 h-8" /> : sharePostContentType === 'posts' ? <ImageIcon className="w-8 h-8" /> : <Globe className="w-8 h-8" />}
                                            </div>
                                            <div className="space-y-4 flex flex-col items-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No {sharePostContentType === 'all' ? 'media' : sharePostContentType} found</p>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); fetchSharePostMedia(); }}
                                                    className="px-5 py-2.5 bg-slate-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-gray-700 shadow-sm flex items-center gap-2"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                    Sync Content
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            ref={mediaGridRef}
                                            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 scrollbar-thin overflow-y-auto max-h-[600px] pr-2"
                                        >
                                            {sortedMedia.map((media: any) => (
                                                <button
                                                    key={media.id}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                    onUpdate({
                                                        ...templateData,
                                                        media_id: media.id,
                                                        media_url: media.media_url || '',
                                                        thumbnail_url: media.thumbnail_url || media.media_url || undefined,
                                                        preview_media_url: media.thumbnail_url || media.media_url || undefined,
                                                        linked_media_url: media.media_url || '',
                                                        caption: media.caption || '',
                                                        media_type: media.media_type || '',
                                                        permalink: media.permalink || ''
                                                    });
                                                }}
                                                    className={`group relative aspect-[4/5] rounded-3xl overflow-hidden border-4 transition-all duration-300 ${templateData.media_id === media.id
                                                        ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-xl'
                                                        : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800 shadow-md hover:shadow-lg'
                                                        }`}
                                                >
                                                    <img
                                                        src={toBrowserPreviewUrl(media.thumbnail_url || media.media_url || '')}
                                                        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${templateData.media_id === media.id ? 'brightness-75' : ''}`}
                                                        alt={media.caption || ''}
                                                        loading="lazy"
                                                    />
                                                    {templateData.media_id === media.id && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="bg-blue-600 text-white rounded-full p-2.5 shadow-2xl scale-125 animate-in zoom-in duration-300">
                                                                <CheckCircle2 className="w-5 h-5 stroke-[4]" />
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                        <div className="flex items-center gap-1.5 mb-1 text-[8px] font-black text-blue-400 uppercase tracking-widest">
                                                            <Calendar className="w-2.5 h-2.5" />
                                                            {new Date(media.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </div>
                                                        <p className="text-[9px] text-white font-bold line-clamp-2 leading-relaxed">{media.caption || 'Untitled Media'}</p>
                                                    </div>
                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-white text-[7px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {media.media_type === 'VIDEO' ? 'Reel' : 'Post'}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Selected Media Display - Exact match with InboxMenu */}
                    {templateData.media_id && !templateData.use_latest_post && (
                        <div className="pt-6 border-t border-content space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-0.5">Media Selected</p>
                                        <p className="text-[9px] text-gray-400 font-bold">Selected ID: {templateData.media_id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onUpdate({
                                            ...templateData,
                                            media_id: '',
                                            media_url: '',
                                            thumbnail_url: '',
                                            preview_media_url: '',
                                            linked_media_url: '',
                                            caption: '',
                                            media_type: '',
                                            permalink: ''
                                        });
                                    }}
                                    className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                                >
                                    Change Selection
                                </button>
                            </div>
                        </div>
                    )}


                    {/* Info Box - Exact match with InboxMenu */}
                    <div className="p-8 bg-blue-50 dark:bg-blue-500/5 rounded-[32px] border border-blue-100 dark:border-blue-500/10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-blue-50 dark:border-blue-500/10">
                                <Info className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Live Instagram Sync</p>
                                <p className="text-[10px] font-medium text-gray-400 leading-relaxed mb-3">
                                    {sharePostDateRange === 'all'
                                        ? `Showing your most recent ${sharePostContentType === 'all' ? 'media' : sharePostContentType} directly from Instagram. Select the one you'd like to share.`
                                        : `Showing ${sharePostContentType === 'all' ? 'media' : sharePostContentType} from ${sharePostDateRange} directly from Instagram.`
                                    }
                                </p>
                                <div className="flex items-start gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                    <AlertCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                                    <p className="text-[9px] font-bold text-blue-500/80 uppercase tracking-widest leading-relaxed">
                                        Note: Instagram allows fetching up to 10,000 recently created posts and reels through the workspace.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderQuickRepliesTemplate = () => (
        <div className="space-y-6">
            {/* Title Text - Exact match with InboxMenu */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-content">
                <div className="flex justify-between items-center px-1 mb-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Title Text (Prompt Message)</label>
                    <span className={`text-[8px] font-bold ${getByteLength(templateData.text || '') > 950 ? 'text-red-500' : 'text-gray-400'}`}>
                        {getByteLength(templateData.text || '')}/950 bytes
                    </span>
                </div>
                <textarea
                    id="field_template_content"
                    value={templateData.text || ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (getByteLength(val) <= 950) {
                            onUpdate({ ...templateData, text: val });
                            clearValidationError('template_content');
                        }
                    }}
                    placeholder="Enter the title text that will prompt a person to click a quick reply..."
                    className={`w-full bg-white dark:bg-gray-900 border-2 ${validationErrors.template_content ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} focus:border-blue-500/50 rounded-2xl p-4 text-xs font-bold text-gray-900 dark:text-gray-100 min-h-[100px] shadow-xl shadow-black/5 resize-none`}
                />
                {validationErrors['template_content'] && (
                    <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1 mt-2">
                        <AlertCircle className="w-3 h-3" /> {validationErrors['template_content']}
                    </p>
                )}
            </div>

            {/* Quick Reply Buttons - Exact match with InboxMenu grid layout */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <Reply className="w-4 h-4 text-blue-500" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                            Quick Reply Buttons ({(templateData.replies || []).length}/13)
                        </h4>
                    </div>
                    {(templateData.replies || []).length < 13 && (
                        <button
                            onClick={() => {
                                const replies = [...(templateData.replies || []), { title: '', payload: '', content_type: 'text' }];
                                onUpdate({ ...templateData, replies });
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-blue-500/20"
                        >
                            <Plus className="w-3 h-3" /> Add Button
                        </button>
                    )}
                </div>

                <div className="grid gap-4">
                    {(templateData.replies || []).map((reply: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-content shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                <div className="md:col-span-5 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Button Text</label>
                                        <span className={`text-[7px] font-bold ${getByteLength(reply.title || '') > 20 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {getByteLength(reply.title || '')}/20 bytes
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        id={`field_reply_${idx}`}
                                        value={reply.title || ''}
                                        onChange={(e) => {
                                            const replies = [...(templateData.replies || [])];
                                            replies[idx] = { ...replies[idx], title: e.target.value };
                                            onUpdate({ ...templateData, replies });
                                            clearValidationError(`reply_${idx}`);
                                        }}
                                        placeholder="e.g. Yes please!"
                                        className={`w-full bg-gray-50 dark:bg-gray-900/50 border-2 ${validationErrors[`reply_${idx}`] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-3 text-[11px] font-semibold text-gray-900 dark:text-gray-100 focus:border-blue-500/50 shadow-inner transition-all`}
                                    />
                                    {validationErrors[`reply_${idx}`] && (
                                        <p className="text-[8px] font-bold text-red-500 px-1">{validationErrors[`reply_${idx}`]}</p>
                                    )}
                                </div>
                                <div className="md:col-span-6 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Reply</label>
                                        <span className={`text-[7px] font-bold ${getByteLength(reply.payload || '') > 950 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {getByteLength(reply.payload || '')}/950 bytes
                                        </span>
                                    </div>
                                    <textarea
                                        id={`field_reply_${idx}_payload`}
                                        value={reply.payload || ''}
                                        onChange={(e) => {
                                            const replies = [...(templateData.replies || [])];
                                            replies[idx] = { ...replies[idx], payload: e.target.value };
                                            onUpdate({ ...templateData, replies });
                                            clearValidationError(`reply_${idx}_payload`);
                                        }}
                                        placeholder="Message to send when clicked..."
                                        className={`w-full bg-gray-50 dark:bg-gray-900/50 border-2 ${validationErrors[`reply_${idx}_payload`] ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-3 text-[11px] font-medium text-gray-900 dark:text-gray-100 focus:border-blue-500/50 h-[64px] resize-none shadow-inner transition-all`}
                                    />
                                    {validationErrors[`reply_${idx}_payload`] && (
                                        <p className="text-[8px] font-bold text-red-500 px-1">{validationErrors[`reply_${idx}_payload`]}</p>
                                    )}
                                </div>
                                <div className="md:col-span-1 pt-4 md:pt-6 flex justify-end">
                                    {(templateData.replies || []).length > 1 && (
                                        <button
                                            onClick={() => {
                                                const replies = (templateData.replies || []).filter((_: any, i: number) => i !== idx);
                                                onUpdate({ ...templateData, replies });
                                            }}
                                            className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    switch (templateType) {
        case 'template_text':
            return renderTextTemplate();
        case 'template_carousel':
            return renderCarouselTemplate();
        case 'template_buttons':
            return renderButtonsTemplate();
        case 'template_media':
            return renderMediaTemplate();
        case 'template_share_post':
            return renderSharePostTemplate();
        case 'template_quick_replies':
            return renderQuickRepliesTemplate();
        default:
            return null;
    }
};

export default SharedTemplateEditor;
