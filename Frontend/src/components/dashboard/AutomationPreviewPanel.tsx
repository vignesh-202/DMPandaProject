import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X } from 'lucide-react';

interface AutomationPreviewPanelProps {
    children: React.ReactNode;
    title?: string;
    minHeightClassName?: string;
    wrapperClassName?: string;
    showMobileTrigger?: boolean;
    mobileTriggerLabel?: string;
}

const AutomationPreviewPanel: React.FC<AutomationPreviewPanelProps> = ({
    children,
    title,
    minHeightClassName = '',
    wrapperClassName = 'order-1 hidden min-h-0 w-full lg:block xl:order-2 xl:col-span-4 xl:self-start xl:max-h-[calc(100vh-7rem)]',
    showMobileTrigger = true,
    mobileTriggerLabel = 'Live Preview',
}) => {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <div className={wrapperClassName}>
                <div className="lg:sticky lg:top-4">
                    {title && (
                        <div className="mb-4 text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
                        </div>
                    )}
                    <div className={`bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border ${minHeightClassName}`.trim()}>
                        {children}
                    </div>
                </div>
            </div>

            {showMobileTrigger && (
                <div className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-ig-purple via-ig-pink to-ig-orange text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
                    >
                        <Eye className="w-5 h-5 flex-shrink-0" />
                        <span className="font-bold text-sm whitespace-nowrap">{mobileTriggerLabel}</span>
                    </button>
                </div>
            )}

            {showMobileTrigger && showModal && createPortal(
                <div
                    className="lg:hidden fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="relative w-full max-w-[340px] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="absolute -top-12 right-0 z-10 p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
                            aria-label="Close preview"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        {title && (
                            <div className="mb-3 text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{title}</span>
                            </div>
                        )}
                        <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                            {children}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AutomationPreviewPanel;
