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
    wrapperClassName = 'order-2 hidden min-h-0 w-full md:block xl:order-2 xl:col-span-4 xl:self-start xl:max-h-[calc(100vh-7rem)]',
    showMobileTrigger = true,
    mobileTriggerLabel = 'Live Preview',
}) => {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <div className={wrapperClassName}>
                <div className="md:sticky md:top-4 xl:top-6">
                    {title && (
                        <div className="mb-4 text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
                        </div>
                    )}
                    <div className={`flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted/40 p-4 ${minHeightClassName}`.trim()}>
                        {children}
                    </div>
                </div>
            </div>

            {showMobileTrigger && (
                <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 px-1 md:hidden">
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-ig-purple via-ig-pink to-ig-orange px-5 py-3 text-white shadow-xl transition-all hover:shadow-2xl active:scale-[0.99]"
                    >
                        <Eye className="w-5 h-5 flex-shrink-0" />
                        <span className="font-bold text-sm whitespace-nowrap">{mobileTriggerLabel}</span>
                    </button>
                </div>
            )}

            {showMobileTrigger && showModal && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 md:hidden"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="relative flex w-full max-w-md flex-col animate-in zoom-in-95 duration-200"
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
                        <div className="overflow-hidden rounded-3xl border border-border bg-card/95 shadow-2xl">
                            <div className="max-h-[min(78vh,42rem)] overflow-y-auto bg-muted/40 p-4">
                                <div className="flex flex-col items-center justify-center">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AutomationPreviewPanel;
