import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'danger' | 'warning';
    loading?: boolean;
    confirmDisabled?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

const toneStyles = {
    danger: {
        icon: Trash2,
        iconWrap: 'bg-rose-500/12 text-rose-500 border-rose-500/20',
        confirm: 'bg-rose-600 text-white hover:bg-rose-500'
    },
    warning: {
        icon: AlertTriangle,
        iconWrap: 'bg-amber-500/12 text-amber-500 border-amber-500/20',
        confirm: 'bg-amber-500 text-slate-950 hover:bg-amber-400'
    }
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'danger',
    loading = false,
    confirmDisabled = false,
    onCancel,
    onConfirm
}) => {
    useEffect(() => {
        if (!open) return undefined;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loading) {
                onCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('keydown', handleEscape);
        };
    }, [loading, onCancel, open]);

    if (!open) return null;

    const overlayRoot = typeof document !== 'undefined'
        ? document.querySelector('[data-admin-section-overlay-root]') as HTMLElement | null
        : null;
    const useSectionOverlay = Boolean(overlayRoot);

    const toneConfig = toneStyles[tone];
    const Icon = toneConfig.icon;

    const modal = (
        <div className={cn(
            useSectionOverlay
                ? 'pointer-events-auto absolute inset-0 z-[220] flex items-center justify-center p-4'
                : 'pointer-events-auto fixed inset-0 z-[220] flex items-center justify-center p-4'
        )}>
            <button
                type="button"
                aria-label="Close confirmation dialog"
                disabled={loading}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
                onClick={onCancel}
            />
            <div className="ig-topline relative z-[221] w-full max-w-lg overflow-hidden rounded-[30px] border border-border/70 bg-card/95 shadow-[0_32px_80px_-28px_rgba(15,23,42,0.55)] backdrop-blur-xl">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/75 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="space-y-6 px-6 py-7 sm:px-8">
                    <div className="space-y-4 pr-10">
                        <div className={cn('flex h-14 w-14 items-center justify-center rounded-[20px] border', toneConfig.iconWrap)}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground">Confirmation Required</p>
                            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
                            <div className="mt-3 text-sm leading-6 text-muted-foreground">
                                {description}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="btn-secondary px-5 py-3 text-[10px] disabled:opacity-60"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading || confirmDisabled}
                            className={cn('inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] font-black transition disabled:opacity-60', toneConfig.confirm)}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, overlayRoot || document.body);
};

export default ConfirmDialog;
