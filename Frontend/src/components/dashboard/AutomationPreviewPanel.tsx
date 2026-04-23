import React from 'react';

interface AutomationPreviewPanelProps {
    children: React.ReactNode;
    title?: string;
    minHeightClassName?: string;
    wrapperClassName?: string;
}

const AutomationPreviewPanel: React.FC<AutomationPreviewPanelProps> = ({
    children,
    title,
    minHeightClassName = '',
    wrapperClassName = 'order-1 hidden min-h-0 w-full lg:block xl:order-2 xl:col-span-4 xl:self-start xl:max-h-[calc(100vh-7rem)]'
}) => {
    return (
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
    );
};

export default AutomationPreviewPanel;
