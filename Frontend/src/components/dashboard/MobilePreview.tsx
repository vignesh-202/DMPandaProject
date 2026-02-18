import React, { useRef, useState } from 'react';
import {
    ChevronRight, Smartphone, RefreshCcw, Instagram,
    Image as ImageIcon, Video, Music, FileText, Reply,
    MousePointerClick, Share2
} from 'lucide-react';

interface MobilePreviewProps {
    automation: any;
    displayName?: string;
    profilePic?: string;
    isMediaDeleted?: boolean;
}

const MobilePreview: React.FC<MobilePreviewProps> = ({
    automation,
    displayName = "your_account",
    profilePic,
    isMediaDeleted: propsIsMediaDeleted
}) => {
    const carouselRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [localIsMediaDeleted, setLocalIsMediaDeleted] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    const isMediaDeleted = propsIsMediaDeleted !== undefined ? propsIsMediaDeleted : localIsMediaDeleted;

    React.useEffect(() => {
        if (automation?.template_type === 'template_share_post' && automation.media_url) {
            const img = new window.Image();
            img.src = automation.media_url;
            img.onload = () => setLocalIsMediaDeleted(false);
            img.onerror = () => setLocalIsMediaDeleted(true);
        } else {
            setLocalIsMediaDeleted(false);
        }
    }, [automation?.template_type, automation?.media_url]);

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.pageX - (carouselRef.current?.offsetLeft || 0));
        setScrollLeft(carouselRef.current?.scrollLeft || 0);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        updateCurrentSlide();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !carouselRef.current) return;
        e.preventDefault();
        const x = e.pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        carouselRef.current.scrollLeft = scrollLeft - walk;
    };

    // Touch events for mobile swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        setStartX(e.touches[0].pageX - (carouselRef.current?.offsetLeft || 0));
        setScrollLeft(carouselRef.current?.scrollLeft || 0);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        updateCurrentSlide();
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || !carouselRef.current) return;
        const x = e.touches[0].pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        carouselRef.current.scrollLeft = scrollLeft - walk;
    };

    // Update current slide indicator based on scroll position
    const updateCurrentSlide = () => {
        if (!carouselRef.current) return;
        const slideWidth = 200 + 12; // card width + gap
        const newSlide = Math.round(carouselRef.current.scrollLeft / slideWidth);
        setCurrentSlide(newSlide);
    };

    // Scroll to specific slide
    const scrollToSlide = (index: number) => {
        if (!carouselRef.current) return;
        const slideWidth = 200 + 12;
        carouselRef.current.scrollTo({
            left: index * slideWidth,
            behavior: 'smooth'
        });
        setCurrentSlide(index);
    };

    return (
        <div className="relative w-[300px] h-[600px] mx-auto bg-white dark:bg-black rounded-[50px] border-[8px] border-gray-900 shadow-[0_0_60px_rgba(0,0,0,0.15)] overflow-hidden scale-95 origin-top lg:scale-100 flex flex-col">
            {/* Camera/Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-3xl z-40 flex items-center justify-center">
                <div className="w-10 h-1.5 bg-gray-800 rounded-full" />
            </div>

            {/* Status Bar */}
            <div className="h-10 flex justify-between items-center px-8 pt-6 z-30 text-[11px] font-bold dark:text-white text-gray-900">
                <span>9:41</span>
                <div className="flex gap-1.5 items-center">
                    <div className="w-4 h-4 border-2 border-current rounded-[3px]" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full" />
                </div>
            </div>

            {/* Instagram Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-black">
                <div className="flex items-center gap-3">
                    <ChevronRight className="w-5 h-5 rotate-180" />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[1.5px]">
                        <div className="w-full h-full rounded-full bg-white dark:bg-black p-[1px]">
                            <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {profilePic ? (
                                    <img src={profilePic} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <Instagram className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="text-[12px] font-bold dark:text-white truncate max-w-[100px]">@{displayName}</div>
                        <div className="text-[9px] text-gray-400">Instagram</div>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-gray-900 dark:text-white">
                    <Smartphone className="w-4 h-4" />
                    <RefreshCcw className="w-4 h-4" />
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-black">
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

                {/* Incoming (Automation Reply) */}
                <div className="flex justify-start items-end gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 mb-1 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                        {profilePic ? (
                            <img src={profilePic} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <Instagram className="w-3 h-3 text-gray-400" />
                        )}
                    </div>
                    <div className="max-w-[85%] space-y-2">
                        {automation?.template_type === 'template_text' && (
                            <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-2xl rounded-bl-sm text-[12px] shadow-sm dark:text-gray-200">
                                {automation?.template_content || 'Text message response...'}
                            </div>
                        )}

                        {automation?.template_type === 'template_carousel' && (
                            <div className="relative group/carousel h-full flex flex-col">
                                <div
                                    ref={carouselRef}
                                    onMouseDown={handleMouseDown}
                                    onMouseLeave={handleMouseLeave}
                                    onMouseUp={handleMouseUp}
                                    onMouseMove={handleMouseMove}
                                    onTouchStart={handleTouchStart}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchMove={handleTouchMove}
                                    onScroll={updateCurrentSlide}
                                    className="flex overflow-x-auto gap-3 pb-2 px-4 -mx-2 snap-x snap-mandatory no-scrollbar cursor-grab active:cursor-grabbing select-none touch-pan-x"
                                    style={{
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        scrollSnapType: isDragging ? 'none' : 'x mandatory',
                                        WebkitOverflowScrolling: 'touch'
                                    }}
                                >
                                    {(Array.isArray(automation.template_elements) ? automation.template_elements : []).map((el: any, i: number) => {
                                        const displayImage = el.image_url || null;
                                        return (
                                            <div key={i} className="min-w-[200px] w-[200px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col snap-center select-none" style={{ pointerEvents: isDragging ? 'none' : 'auto' }}>
                                                <div className="aspect-[1.91/1] bg-gray-100 dark:bg-gray-900 relative">
                                                    {displayImage ? (
                                                        <img src={displayImage} alt="" draggable={false} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-8 h-8" /></div>
                                                    )}
                                                </div>
                                                <div className="p-3 flex flex-col gap-1">
                                                    <div className="font-bold text-[11px] text-gray-900 dark:text-white leading-tight">{el.title || 'Headline'}</div>
                                                    <div className="text-[10px] text-gray-500 leading-tight">{el.subtitle || 'Subtitle'}</div>
                                                    <div className="pt-2 space-y-1 mt-auto">
                                                        {(el.buttons || []).map((btn: any, bi: number) => (
                                                            <div key={bi} className="py-1.5 px-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-center text-[11px] font-semibold text-[#0095F6] truncate">
                                                                {btn.title || 'Button'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Slide indicators */}
                                {(Array.isArray(automation.template_elements) && automation.template_elements.length > 1) && (
                                    <div className="flex justify-center gap-1.5 pt-2 pb-1">
                                        {automation.template_elements.map((_: any, i: number) => (
                                            <button
                                                key={i}
                                                onClick={() => scrollToSlide(i)}
                                                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                                                    currentSlide === i 
                                                        ? 'bg-[#0095F6] w-4' 
                                                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {automation?.template_type === 'template_media' && (
                            <div className="max-w-[85%] rounded-2xl overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                <div className="relative bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                    {automation.template_content && (automation.template_content.startsWith('http') || automation.template_content.startsWith('/')) ? (
                                        <>
                                            {(automation.media_type || 'image') === 'image' && (
                                                <img src={automation.template_content} className="w-full h-full object-cover" alt="" />
                                            )}
                                            {(automation.media_type || 'image') === 'video' && (
                                                <div className="relative w-full h-full flex items-center justify-center bg-black/5 min-h-[120px]">
                                                    <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center">
                                                        <Video className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-8 px-6">
                                            <ImageIcon className="w-6 h-6 text-gray-400" />
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Awaiting Media</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(automation?.template_type === 'template_buttons' || automation?.template_type === 'template_quick_replies') && (
                            <div className="space-y-2">
                                <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-2xl rounded-bl-sm text-[12px] shadow-sm dark:text-gray-200">
                                    {automation?.text || automation?.template_content || 'Response text...'}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(automation.buttons || automation.replies || []).map((btn: any, i: number) => (
                                        <div key={i} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-[11px] font-bold text-[#0095F6] shadow-sm">
                                            {btn.title || 'Button'}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {automation?.template_type === 'template_share_post' && (
                            <div className="min-w-[170px] max-w-[220px] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 flex flex-col">
                                <div className="p-2 flex items-center gap-2 border-b border-gray-50 dark:border-gray-800">
                                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden ring-1 ring-gray-100 dark:ring-gray-800">
                                        {profilePic ? (
                                            <img src={profilePic} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Instagram className="w-2.5 h-2.5 text-gray-400" />
                                        )}
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-900 dark:text-gray-100 truncate">
                                        {displayName}
                                    </span>
                                </div>
                                <div className="aspect-square bg-gray-50 dark:bg-gray-950 flex items-center justify-center relative group">
                                    {isMediaDeleted ? (
                                        <div className="flex flex-col items-center gap-2 p-6 animate-in fade-in duration-500">
                                            <div className="w-12 h-12 rounded-[1.25rem] bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500/50">
                                                <Share2 className="w-6 h-6" />
                                            </div>
                                            <p className="text-[8px] font-black text-red-500 uppercase tracking-widest text-center">Media Deleted</p>
                                        </div>
                                    ) : automation.media_url ? (
                                        <div className="absolute inset-0">
                                            <img src={automation.media_url} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg scale-90 origin-bottom-left border border-white/10">
                                                <Share2 className="w-2.5 h-2.5 text-white" />
                                                <span className="text-[8px] text-white font-black uppercase tracking-widest">Content</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 p-6">
                                            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                                                <Share2 className="w-5 h-5 text-gray-300" />
                                            </div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Select Content</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-950 border-t border-slate-100 dark:border-slate-800">
                                    <div className="space-y-1.5">
                                        <div className="h-1.5 w-[85%] bg-slate-100 dark:bg-gray-800 rounded-full" />
                                        <div className="h-1.5 w-[50%] bg-slate-50 dark:bg-gray-800/50 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobilePreview;
