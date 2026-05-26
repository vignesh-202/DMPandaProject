import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X } from 'lucide-react';
import { FAST_TRANSITION } from '../../lib/animation';

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
                    <div className={`flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted/40 p-3 sm:p-4 ${minHeightClassName}`.trim()}>
                        {children}
                    </div>
                </div>
            </div>

            {showMobileTrigger && createPortal(
                <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[110] w-auto max-w-[calc(100%-2rem)] -translate-x-1/2 px-1 md:hidden">
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className={`inline-flex min-h-11 min-w-[12rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-ig-purple via-ig-pink to-ig-orange px-4 py-2.5 text-white shadow-xl ${FAST_TRANSITION} hover:shadow-2xl active:scale-[0.99]`}
                    >
                        <Eye className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="whitespace-nowrap text-sm font-bold leading-none">{mobileTriggerLabel}</span>
                    </button>
                </div>,
                document.body
            )}

            {showMobileTrigger && showModal && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 md:hidden sm:items-center sm:p-4"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="relative flex h-[min(100dvh-1.5rem,46rem)] w-full max-w-[24rem] flex-col animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[min(88vh,46rem)] sm:max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className={`absolute right-0 top-3 z-10 rounded-full bg-black/25 p-2 text-white backdrop-blur-md hover:bg-black/40 sm:-top-12 sm:bg-white/10 sm:hover:bg-white/20 ${FAST_TRANSITION}`}
                            aria-label="Close preview"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        {title && (
                            <div className="mb-3 text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{title}</span>
                            </div>
                        )}
                        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-border bg-card/95 shadow-2xl sm:rounded-3xl">
                            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/40 px-1.5 py-2 sm:p-4">
                                <div className="flex scale-[0.85] xs:scale-[0.9] sm:scale-[0.94] md:scale-[0.98] origin-center flex-col items-center justify-center w-full h-auto max-h-full">
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
