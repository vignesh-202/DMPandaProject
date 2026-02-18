import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronRight, Smartphone, RefreshCcw, Instagram, Menu,
    Image as ImageIcon, Video, Music, FileText, Reply,
    MousePointerClick, Share2, MessageSquare, LayoutGrid, List, MessageCircle, Camera, Mic, PlusSquare, ExternalLink
} from 'lucide-react';

export type PreviewMode = 'menu' | 'convo_starter' | 'automation';

export interface MenuItemType {
    title?: string;
    question?: string;
    type?: 'postback' | 'web_url';
    payload?: string;
    url?: string;
    template_type?: 'template_text' | 'template_carousel' | 'template_buttons' | 'template_media' | 'template_share_post' | 'template_quick_replies';
    template_data?: any;
}

export interface AutomationType {
    template_type?: 'template_text' | 'template_carousel' | 'template_buttons' | 'template_media' | 'template_share_post' | 'template_quick_replies' | 'template_media_attachment' | 'template_url';
    template_content?: string;
    template_elements?: any[];
    replies?: any[];
    buttons?: any[];
    media_id?: string;
    media_url?: string;
    thumbnail_url?: string;
    caption?: string;
    text?: string;
    keywords?: string[];
    keyword?: string;
    use_latest_post?: boolean;
    latest_post_type?: 'post' | 'reel';
    template_data?: any;
}

export interface SharedMobilePreviewProps {
    mode: PreviewMode;
    items?: MenuItemType[];
    automation?: AutomationType;
    displayName?: string;
    profilePic?: string;
    isEditing?: boolean;
    newItem?: MenuItemType | null;
    automations?: any[];
    fetchedAutomations?: Record<string, any>;
    isMediaDeleted?: boolean;
}

const isRestrictedMediaUrl = (url?: string | null) =>
    !!url && /scontent\.cdninstagram\.com/i.test(url);

const SharedMobilePreview: React.FC<SharedMobilePreviewProps> = ({
    mode,
    items = [],
    automation,
    displayName = 'Username',
    profilePic,
    isEditing = false,
    newItem = null,
    automations = [],
    fetchedAutomations = {},
    isMediaDeleted: propsIsMediaDeleted
}) => {
    const [activeIdx, setActiveIdx] = useState<number | null>(null);
    const [localIsMediaDeleted, setIsMediaDeleted] = useState(false);
    const carouselRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const isMediaDeleted = propsIsMediaDeleted !== undefined ? propsIsMediaDeleted : localIsMediaDeleted;

    // Determine display items based on mode
    const displayItems = mode === 'menu' || mode === 'convo_starter'
        ? (isEditing && newItem ? [newItem] : items)
        : [];

    // Set active index for editing mode
    useEffect(() => {
        if (isEditing && newItem) {
            if (mode === 'menu' && newItem.type === 'postback') {
                setActiveIdx(0);
            } else if (mode === 'convo_starter') {
                setActiveIdx(0);
            }
        } else {
            setActiveIdx(null);
        }
    }, [isEditing, newItem, mode, items]);

    // Get template type icon
    const getTemplateTypeIcon = (type?: string) => {
        switch (type) {
            case 'template_text': return <MessageSquare className="w-3.5 h-3.5" />;
            case 'template_carousel': return <LayoutGrid className="w-3.5 h-3.5" />;
            case 'template_buttons': return <Smartphone className="w-3.5 h-3.5" />;
            case 'template_media': return <ImageIcon className="w-3.5 h-3.5" />;
            case 'template_share_post': return <Instagram className="w-3.5 h-3.5" />;
            case 'template_quick_replies': return <List className="w-3.5 h-3.5" />;
            default: return <MessageCircle className="w-3.5 h-3.5" />;
        }
    };

    // Helper to extract data from template_data
    const getTemplateData = (data: any) => {
        if (!data) return {};
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse template_data:', e);
                return {};
            }
        }
        return data;
    };

    const inferTemplateType = (td: any) => {
        if (!td) return undefined;
        if (td.elements) return 'template_carousel';
        if (td.replies) return 'template_quick_replies';
        if (td.buttons) return 'template_buttons';
        if (td.media_id || td.use_latest_post || td.latest_post_type) return 'template_share_post';
        if (td.media_url) return 'template_media';
        if (td.text) return 'template_text';
        return undefined;
    };

    const applyTemplateData = (target: any, td: any) => {
        if (!target || !td) return target;
        if (!target.template_content && td.text) target.template_content = td.text;
        if (!target.template_elements && td.elements) target.template_elements = td.elements;
        if (!target.replies && td.replies) target.replies = td.replies;
        if (!target.buttons && td.buttons) target.buttons = td.buttons;
        if (!target.media_url && td.media_url) target.media_url = td.media_url;
        if (!target.media_id && td.media_id) target.media_id = td.media_id;
        if (target.use_latest_post === undefined && td.use_latest_post !== undefined) target.use_latest_post = td.use_latest_post;
        if (!target.latest_post_type && td.latest_post_type) target.latest_post_type = td.latest_post_type;
        if (!target.caption && td.caption) target.caption = td.caption;
        if (!target.template_data || Object.keys(target.template_data || {}).length === 0) target.template_data = td;
        return target;
    };

    // Helper to get text content with deep fallbacks
    const getTemplateText = (a: any) => {
        if (!a) return '';
        const td = getTemplateData(a.template_data);
        return a.template_content || a.text || td.text || '...';
    };

    // Determine the automation to preview
    let auto: any = null;

    if (mode === 'automation' && automation) {
        auto = { ...automation };
        const td = getTemplateData(auto.template_data);
        applyTemplateData(auto, td);
        if (!auto.template_type) {
            auto.template_type = td.template_type || inferTemplateType(td);
        }
    } else if (mode === 'menu' || mode === 'convo_starter') {
        const activePreviewItem = activeIdx !== null && activeIdx >= 0 && activeIdx < displayItems.length ? displayItems[activeIdx] : null;

        if (activePreviewItem) {
            if (mode === 'menu') {
                const autoInList = automations?.find((a: any) => a.template_id === activePreviewItem?.payload || a.$id === activePreviewItem?.payload || a.id === activePreviewItem?.payload);
                const foundAuto = (autoInList?.$id && fetchedAutomations[autoInList.$id]) || autoInList;

                if (foundAuto) {
                    auto = { ...foundAuto };
                }

                // Fallback/Merge with activePreviewItem data
                const itemTd = getTemplateData(activePreviewItem.template_data);
                if (!auto) {
                    auto = {
                        template_type: activePreviewItem.template_type,
                        template_content: activePreviewItem.template_type === 'template_text' ? itemTd.text :
                            activePreviewItem.template_type === 'template_media' ? itemTd.media_url :
                                activePreviewItem.template_type === 'template_carousel' ? itemTd.elements :
                                    activePreviewItem.template_type === 'template_quick_replies' ? itemTd.text :
                                        activePreviewItem.template_type === 'template_buttons' ? itemTd.text :
                                            undefined,
                        template_elements: activePreviewItem.template_type === 'template_carousel' ? itemTd.elements : undefined,
                        replies: activePreviewItem.template_type === 'template_quick_replies' ? itemTd.replies : undefined,
                        buttons: activePreviewItem.template_type === 'template_buttons' ? itemTd.buttons : undefined,
                        media_id: activePreviewItem.template_type === 'template_share_post' ? itemTd.media_id : undefined,
                        media_url: activePreviewItem.template_type === 'template_share_post' ? itemTd.media_url : undefined,
                        use_latest_post: activePreviewItem.template_type === 'template_share_post' ? itemTd.use_latest_post : undefined,
                        latest_post_type: activePreviewItem.template_type === 'template_share_post' ? itemTd.latest_post_type : undefined,
                        template_data: itemTd
                    };
                } else {
                    applyTemplateData(auto, itemTd);
                    if (!auto.template_type) {
                        auto.template_type = activePreviewItem.template_type || itemTd.template_type || inferTemplateType(itemTd);
                    }
                }
            } else if (mode === 'convo_starter') {
                const starterTd = getTemplateData(activePreviewItem.template_data);
                auto = {
                    template_type: activePreviewItem.template_type,
                    template_content: activePreviewItem.template_type === 'template_text' ? starterTd.text :
                        activePreviewItem.template_type === 'template_media' ? starterTd.media_url :
                            activePreviewItem.template_type === 'template_carousel' ? starterTd.elements :
                                activePreviewItem.template_type === 'template_quick_replies' ? starterTd.text :
                                    activePreviewItem.template_type === 'template_buttons' ? starterTd.text :
                                        undefined,
                    template_elements: activePreviewItem.template_type === 'template_carousel' ? starterTd.elements : undefined,
                    replies: activePreviewItem.template_type === 'template_quick_replies' ? starterTd.replies : undefined,
                    buttons: activePreviewItem.template_type === 'template_buttons' ? starterTd.buttons : undefined,
                    media_id: activePreviewItem.template_type === 'template_share_post' ? starterTd.media_id : undefined,
                    media_url: activePreviewItem.template_type === 'template_share_post' ? starterTd.media_url : undefined,
                    use_latest_post: activePreviewItem.template_type === 'template_share_post' ? starterTd.use_latest_post : undefined,
                    latest_post_type: activePreviewItem.template_type === 'template_share_post' ? starterTd.latest_post_type : undefined,
                    template_data: starterTd
                };
                if (!auto.template_type) {
                    auto.template_type = starterTd.template_type || inferTemplateType(starterTd);
                }
            }
        }
    }

    // Check media deletion
    useEffect(() => {
        if (auto?.template_type === 'template_share_post' && auto.media_url) {
            const img = new window.Image();
            img.src = auto.media_url;
            img.onload = () => setIsMediaDeleted(false);
            img.onerror = () => setIsMediaDeleted(true);
        } else {
            setIsMediaDeleted(false);
        }
    }, [auto?.template_type, auto?.media_url]);

    // Carousel drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!carouselRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - carouselRef.current.offsetLeft);
        setScrollLeft(carouselRef.current.scrollLeft);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !carouselRef.current) return;
        e.preventDefault();
        const x = e.pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        carouselRef.current.scrollLeft = scrollLeft - walk;
    };

    const effectiveType = auto ? (
        auto.template_type ||
        inferTemplateType(getTemplateData(auto.template_data)) ||
        (auto.replies ? 'template_quick_replies' : undefined) ||
        (auto.buttons ? 'template_buttons' : undefined) ||
        (auto.template_elements ? 'template_carousel' : undefined) ||
        (auto.media_url || auto.media_id ? 'template_media' : undefined) ||
        (auto.template_content ? 'template_text' : undefined)
    ) : undefined;

    const renderTemplatePreview = () => {
        if (!auto) return null;

        const td = getTemplateData(auto.template_data);
        return (
            <>
                {(effectiveType === 'template_text' || (!effectiveType && (auto.template_content || td.text))) && (
                    <div className="p-3 bg-black dark:bg-gray-900 text-white dark:text-gray-100 rounded-[18px] rounded-bl-[4px] text-[14px] shadow-sm break-words whitespace-normal">
                        {auto.template_content || auto.template_data?.text || '...'}
                    </div>
                )}

                {effectiveType === 'template_quick_replies' && (
                    <div className="p-3 bg-black dark:bg-gray-900 text-white dark:text-gray-100 rounded-[18px] rounded-bl-[4px] text-[14px] shadow-sm break-words whitespace-normal">
                        {auto.template_content || auto.template_data?.text || '...'}
                    </div>
                )}

                {effectiveType === 'template_share_post' && (
                    <div className="min-w-[170px] max-w-[220px] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 message-bubble flex flex-col">
                        <div className="p-2 flex items-center gap-2 border-b border-gray-50 dark:border-gray-800">
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden ring-1 ring-gray-100 dark:ring-gray-800">
                                {profilePic ? (
                                    <img src={profilePic} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <Instagram className="w-2.5 h-2.5 text-gray-400" />
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-gray-900 dark:text-gray-100 truncate">
                                {displayName}
                            </span>
                        </div>
                        <div className={`aspect-square bg-gray-50 dark:bg-gray-950 flex items-center justify-center relative group ${isMediaDeleted ? 'ring-4 ring-red-500 ring-inset' : ''}`}>
                            {auto.use_latest_post ? (
                                <div className="flex flex-col items-center gap-2 p-6">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Share2 className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest text-center leading-tight">
                                        Latest {auto.latest_post_type === 'reel' ? 'Reel' : 'Post'}
                                    </span>
                                </div>
                            ) : (auto.media_url || auto.template_data?.thumbnail_url || auto.template_data?.media_url) ? (
                                <div className="absolute inset-0">
                                    <img
                                        src={auto.media_url || auto.template_data?.thumbnail_url || auto.template_data?.media_url}
                                        referrerPolicy="no-referrer"
                                        className={`w-full h-full object-cover ${isMediaDeleted ? 'opacity-50' : ''}`}
                                        alt=""
                                    />
                                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg scale-90 origin-bottom-left border border-white/10">
                                        <Share2 className="w-2.5 h-2.5 text-white" />
                                        <span className="text-[8px] text-white font-black uppercase tracking-widest">Post</span>
                                    </div>
                                    {isMediaDeleted && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                                                Media Deleted
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 p-6">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                                        <Share2 className="w-6 h-6 text-gray-300" />
                                    </div>
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center leading-tight">
                                        Post to be shared
                                    </span>
                                </div>
                            )}
                        </div>
                        {(auto.caption || auto.template_data?.caption) && (
                            <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-50 dark:border-gray-800">
                                <p className="text-[10px] text-gray-900 dark:text-gray-100 line-clamp-3 font-medium leading-normal">
                                    <span className="font-bold mr-1">{displayName}</span>
                                    {auto.caption || auto.template_data?.caption}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {effectiveType === 'template_carousel' && (
                    <div
                        ref={carouselRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                        className="flex gap-3 overflow-x-auto pb-4 scroll-smooth no-scrollbar snap-x snap-mandatory cursor-grab active:cursor-grabbing max-w-full"
                    >
                        {(auto.template_elements || auto.template_data?.elements || []).map((el: any, i: number) => (
                            <div key={i} className="flex-shrink-0 w-[200px] bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col snap-center">
                                <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative">
                                    {el.image_url && !isRestrictedMediaUrl(el.image_url) ? (
                                        <img src={el.image_url} referrerPolicy="no-referrer" className="w-full h-full object-cover" draggable={false} alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 border-b border-gray-50 dark:border-gray-700 space-y-0.5">
                                    <div className="font-bold text-[11px] truncate leading-tight">{el.title || 'Headline'}</div>
                                    {el.subtitle && <div className="text-[9px] text-gray-500 truncate leading-tight">{el.subtitle}</div>}
                                </div>
                                {(el.buttons || []).map((btn: any, bi: number) => (
                                    <div key={bi} className="py-2.5 text-center text-[11px] font-bold text-[#0095F6] border-b last:border-b-0 border-gray-100 dark:border-gray-700 px-2 truncate hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        {btn.title || 'Button'}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {effectiveType === 'template_buttons' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 w-[220px]">
                        <div className="p-3 text-[14px] text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">
                            {auto.template_content || auto.text || auto.template_data?.text || 'Button message...'}
                        </div>
                        {(auto.buttons || auto.template_data?.buttons || []).map((btn: any, i: number) => (
                            <div key={i} className="py-2.5 text-center text-[13px] font-bold text-[#0095F6] border-b last:border-b-0 border-gray-100 dark:border-gray-700">
                                {btn.title || 'Button'}
                            </div>
                        ))}
                    </div>
                )}

                {effectiveType === 'template_media' && (
                    <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 w-[220px]">
                        {(auto.template_content || auto.template_data?.media_url) ? (
                            !isRestrictedMediaUrl(auto.template_content || auto.template_data?.media_url) ? (
                                <img
                                    src={auto.template_content || auto.template_data?.media_url}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-auto object-cover max-h-[200px]"
                                    alt=""
                                />
                            ) : (
                                <div className="w-full h-[160px] bg-muted/50 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Preview unavailable
                                </div>
                            )
                        ) : (
                            <div className="w-full h-[140px] bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-300"><ImageIcon className="w-8 h-8" /></div>
                        )}
                    </div>
                )}

                {effectiveType === 'template_media_attachment' && (
                    <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 w-[220px]">
                        {auto.media_url || auto.template_content || auto.template_data?.media_url ? (
                            !isRestrictedMediaUrl(auto.media_url || auto.template_content || auto.template_data?.media_url) ? (
                                <img
                                    src={auto.media_url || auto.template_content || auto.template_data?.media_url}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-auto object-cover max-h-[200px]"
                                    alt=""
                                />
                            ) : (
                                <div className="w-full h-[160px] bg-muted/50 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Preview unavailable
                                </div>
                            )
                        ) : (
                            <div className="w-full h-[140px] bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-300"><ImageIcon className="w-8 h-8" /></div>
                        )}
                    </div>
                )}

                {effectiveType === 'template_url' && (
                    <div className="p-3 bg-black dark:bg-gray-900 text-white dark:text-gray-100 rounded-[18px] rounded-bl-[4px] text-[14px] shadow-sm break-words whitespace-normal border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-widest text-blue-400">
                            <ExternalLink className="w-3 h-3" /> External Link
                        </div>
                        {auto.template_content || auto.template_data?.url || 'https://...'}
                    </div>
                )}
            </>
        );
    };

    const activePreviewItem = activeIdx !== null && activeIdx >= 0 && activeIdx < displayItems.length ? displayItems[activeIdx] : null;

    return (
        <div className="w-full max-w-[340px] mx-auto xl:ml-auto animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="lg:sticky lg:top-24 h-fit flex flex-col items-center">
                <div className="relative w-full h-[640px] bg-white dark:bg-black rounded-[55px] border-[10px] border-gray-900 shadow-[0_0_80px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-3xl z-40 flex items-center justify-center">
                        <div className="w-10 h-1.5 bg-gray-800 rounded-full" />
                    </div>

                    {/* Status Bar */}
                    <div className="h-12 flex justify-between items-center px-9 pt-6 z-30 text-[11px] font-bold dark:text-white text-gray-900">
                        <span>9:41</span>
                        <div className="flex gap-1.5 items-center">
                            <div className="w-4 h-4 border-2 border-current rounded-[3px]" />
                            <div className="w-1.5 h-1.5 bg-current rounded-full" />
                        </div>
                    </div>

                    {/* Instagram Header */}
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-black mt-2">
                        <div className="flex items-center gap-3">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[1.5px]">
                                <div className="w-full h-full rounded-full bg-white dark:bg-black p-[1px]">
                                    <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                        {profilePic ? (
                                            <img src={profilePic} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Instagram className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="text-[13px] font-bold dark:text-white truncate max-w-[120px]">@{displayName}</div>
                                <div className="text-[10px] text-gray-400">Instagram</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-gray-900 dark:text-white">
                            <Smartphone className="w-4 h-4" />
                            {activePreviewItem && (mode === 'menu' || mode === 'convo_starter') && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveIdx(null);
                                    }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    title={mode === 'menu' ? 'Show menu' : 'Show questions'}
                                >
                                    {mode === 'menu' ? <Menu className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
                                </button>
                            )}
                            {!activePreviewItem && mode !== 'automation' && (
                                <RefreshCcw className="w-4 h-4" />
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto bg-white dark:bg-black custom-scrollbar relative flex flex-col">
                        <div className="flex-1 p-5 pb-0 space-y-4">
                            {mode === 'automation' ? (
                                <>
                                    {/* User Message (Keyword) */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] p-3 bg-blue-500 text-white rounded-2xl rounded-br-sm text-[12px] shadow-sm animate-in slide-in-from-right-2">
                                            {(() => {
                                                const kws = Array.isArray(automation?.keywords) ? automation.keywords :
                                                    (typeof automation?.keyword === 'string' ? automation.keyword.split(',') : []);
                                                const last = kws.filter((k: any) => k && k.trim()).pop();
                                                return last || 'Keyword';
                                            })()}
                                        </div>
                                    </div>

                                    {/* Bot Response */}
                                    <div className="flex justify-start items-end gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 mb-1 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                            {profilePic ? (
                                                <img src={profilePic} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <Instagram className="w-3 h-3 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="max-w-[85%] space-y-2">
                                            {renderTemplatePreview()}
                                        </div>
                                    </div>
                                </>
                            ) : mode === 'menu' ? (
                                <>
                                    {activePreviewItem && activePreviewItem.type === 'postback' ? (
                                        <div className="space-y-4">
                                            {/* User Message */}
                                            <div className="flex justify-end animate-in fade-in slide-in-from-right-2 duration-500">
                                                <div className="max-w-[70%] p-3 bg-[#3797f0] text-white rounded-[18px] rounded-br-[4px] text-[13px] font-semibold shadow-sm break-words whitespace-normal">
                                                    {activePreviewItem.title}
                                                </div>
                                            </div>

                                            {/* Bot Response */}
                                            <div className="flex justify-start items-end gap-2 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                                    {profilePic ? <img src={profilePic} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <Instagram className="w-3 h-3 text-gray-400" />}
                                                </div>
                                                <div className="max-w-[85%] space-y-2">
                                                    {auto ? (
                                                        <>
                                                            {renderTemplatePreview()}
                                                            <div className="pt-2 flex justify-center">
                                                                <div className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1.5">
                                                                    {getTemplateTypeIcon(activePreviewItem.template_type)}
                                                                    {auto.template_type?.replace('template_', '').replace('_', ' ') || 'Preview'}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="p-3 bg-black dark:bg-gray-900 text-white dark:text-gray-100 rounded-[18px] rounded-bl-[4px] text-[14px] italic">
                                                            {newItem && newItem.template_data?.text ? newItem.template_data.text : 'Select an automation to see preview...'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center min-h-[300px] animate-in fade-in duration-500">
                                            {activePreviewItem?.type === 'web_url' ? (
                                                <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                                                        <ExternalLink className="w-10 h-10 text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">External Link</p>
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{activePreviewItem.title}</h3>
                                                        <p className="text-[11px] text-blue-500 truncate max-w-[200px]">{activePreviewItem.url || 'https://domain.com'}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <Smartphone className="relative w-12 h-12 mb-4 text-gray-400" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Inbox Menu Preview</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : mode === 'convo_starter' ? (
                                <>
                                    {activePreviewItem ? (
                                        <div className="space-y-4">
                                            {/* User Message (Question) */}
                                            <div className="flex justify-end animate-in fade-in slide-in-from-right-2 duration-500">
                                                <div className="max-w-[70%] p-3 bg-[#3797f0] text-white rounded-[18px] rounded-br-[4px] text-[13px] font-semibold shadow-sm break-words whitespace-normal">
                                                    {activePreviewItem.question}
                                                </div>
                                            </div>

                                            {/* Bot Response */}
                                            <div className="flex justify-start items-end gap-2 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                                    {profilePic ? <img src={profilePic} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <Instagram className="w-3 h-3 text-gray-400" />}
                                                </div>
                                                <div className="max-w-[85%] space-y-2">
                                                    {auto ? (
                                                        <>
                                                            {renderTemplatePreview()}
                                                            <div className="pt-2 flex justify-center">
                                                                <div className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1.5">
                                                                    {getTemplateTypeIcon(activePreviewItem.template_type)}
                                                                    {auto.template_type?.replace('template_', '').replace('_', ' ') || 'Preview'}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="p-3 bg-black dark:bg-gray-900 text-white dark:text-gray-100 rounded-[18px] rounded-bl-[4px] text-[14px] italic">
                                                            {newItem && newItem.template_data?.text ? newItem.template_data.text : 'Select a reply type to see preview...'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        displayItems.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-center min-h-[300px] animate-in fade-in duration-500 opacity-30">
                                                <Smartphone className="relative w-12 h-12 mb-4 text-gray-400" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Convo Starter Preview</p>
                                            </div>
                                        )
                                    )}
                                </>
                            ) : null}
                        </div>

                        {/* Bottom Section */}
                        {mode === 'menu' && (!activePreviewItem || activePreviewItem.type === 'web_url') && (
                            <div className="bg-white dark:bg-gray-950 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-30 pt-4 pb-10 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom duration-500">
                                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
                                <div className="px-6 text-center">
                                    <div className="mb-6">
                                        <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-1">Inbox Menu</h3>
                                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Tap a suggestion to interact with {displayName}</p>
                                    </div>
                                    {(() => {
                                        const postbackItems = displayItems.filter(item => item.type === 'postback');
                                        const webUrlItems = displayItems.filter(item => item.type === 'web_url');
                                        return (
                                            <>
                                                {postbackItems.length > 0 && (
                                                    <div className="flex flex-col items-center space-y-2.5 mb-4">
                                                        {postbackItems.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    const actualIdx = displayItems.findIndex(m => m === item);
                                                                    if (actualIdx >= 0) setActiveIdx(actualIdx);
                                                                }}
                                                                className={`w-auto min-w-[160px] py-2.5 px-8 rounded-full transition-all duration-200 flex items-center justify-center group/btn cursor-pointer ${activeIdx === displayItems.findIndex(m => m === item)
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500/30'
                                                                    : 'bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800'
                                                                    }`}
                                                            >
                                                                <span className={`text-[14px] font-bold truncate ${activeIdx === displayItems.findIndex(m => m === item)
                                                                    ? 'text-blue-600 dark:text-blue-400'
                                                                    : 'text-blue-600 dark:text-blue-400'
                                                                    }`}>
                                                                    {item.title || 'Menu Item'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {postbackItems.length > 0 && webUrlItems.length > 0 && (
                                                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-4 mx-10" />
                                                )}
                                                {webUrlItems.length > 0 && (
                                                    <div className="space-y-3 pb-4">
                                                        {webUrlItems.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    const actualIdx = displayItems.findIndex(m => m === item);
                                                                    if (actualIdx >= 0) setActiveIdx(actualIdx);
                                                                }}
                                                                className={`w-full text-center transition-all duration-200 cursor-pointer ${activeIdx === displayItems.findIndex(m => m === item)
                                                                    ? 'opacity-100'
                                                                    : 'opacity-90 hover:opacity-100'
                                                                    }`}
                                                            >
                                                                <div className="text-[14px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">
                                                                    {item.title || 'Visit Website'}
                                                                </div>
                                                                <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                                                                    {item.url ? (item.url.startsWith('http') ? new URL(item.url).hostname.replace('www.', '') : item.url) : 'facebook.com'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {displayItems.length === 0 && (
                                                    <div className="text-center py-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-50">
                                                        No items in menu
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {mode === 'automation' || (mode === 'menu' && activePreviewItem && activePreviewItem.type === 'postback') || (mode === 'convo_starter' && activePreviewItem) ? (
                            <div className="bg-white dark:bg-black p-3 pb-8 z-30 animate-in slide-in-from-bottom duration-500">
                                {effectiveType === 'template_quick_replies' && (
                                    <div className="flex flex-wrap justify-center gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500 px-4">
                                        {(auto.replies ? (typeof auto.replies === 'string' ? JSON.parse(auto.replies) : auto.replies) : []).map((reply: any, i: number) => (
                                            <div key={i} className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-blue-500/20 text-blue-500 rounded-full text-[12px] font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap">
                                                {reply.title || `Option ${i + 1}`}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[1px] flex items-center justify-center">
                                        <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                                            <Camera className="w-5 h-5 text-gray-900 dark:text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full px-4 py-2.5 flex items-center justify-between group focus-within:border-blue-500/50 transition-all">
                                        <span className="text-[14px] text-gray-400 font-medium">Message...</span>
                                        <div className="flex items-center gap-3 text-gray-400">
                                            <Mic className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                                            <ImageIcon className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                                            <PlusSquare className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : mode === 'convo_starter' && !activePreviewItem && displayItems.length > 0 && (
                            <div className="bg-white dark:bg-black z-30 border-t border-gray-100 dark:border-gray-800">
                                <div className="pt-4 pb-3 px-3 space-y-3">
                                    <p className="text-[13px] text-gray-400 dark:text-gray-500 text-center">
                                        Tap to send a question suggested by {displayName}
                                    </p>
                                    <div className="w-full flex flex-col items-center gap-2.5">
                                        {displayItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setActiveIdx(idx)}
                                                className={`w-auto min-w-[160px] py-2.5 px-8 rounded-full transition-all duration-200 flex items-center justify-center group/btn break-words whitespace-normal cursor-pointer ${activeIdx === idx
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500/30'
                                                    : 'bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                <span className={`text-[14px] font-bold ${activeIdx === idx
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : 'text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                    {item.question || 'Question'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-3 pb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[1px] flex items-center justify-center">
                                            <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                                                <Camera className="w-5 h-5 text-gray-900 dark:text-white" />
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full px-4 py-2.5 flex items-center justify-between group focus-within:border-blue-500/50 transition-all">
                                            <span className="text-[14px] text-gray-400 font-medium">Message...</span>
                                            <div className="flex items-center gap-3 text-gray-400">
                                                <Mic className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                                                <ImageIcon className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                                                <PlusSquare className="w-4 h-4 cursor-pointer hover:text-gray-600 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <style dangerouslySetInnerHTML={{
                            __html: `
                                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                                    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
                                    .no-scrollbar::-webkit-scrollbar { display: none; }
                                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                                    .message-bubble { white-space: pre-wrap; word-break: break-word; }
                                `}} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SharedMobilePreview;
