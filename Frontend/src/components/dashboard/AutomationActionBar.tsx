import React from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';

interface AutomationActionBarProps {
    hasExisting: boolean;
    isSaving?: boolean;
    isDeleting?: boolean;
    saveDisabled?: boolean;
    deleteDisabled?: boolean;
    onSave: () => unknown;
    onDelete?: () => unknown;
    onCancel?: () => unknown;
    className?: string;
    leftContent?: React.ReactNode;
    centerContent?: React.ReactNode;
    cancelLabel?: string;
    showCancel?: boolean;
    saveLabel?: string;
}

const AutomationActionBar: React.FC<AutomationActionBarProps> = ({
    hasExisting,
    isSaving = false,
    isDeleting = false,
    saveDisabled = false,
    deleteDisabled = false,
    onSave,
    onDelete,
    onCancel,
    className = '',
    leftContent,
    centerContent,
    cancelLabel = 'Cancel',
    showCancel = true,
    saveLabel
}) => {
    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`.trim()}>
            <div className="flex min-w-0 items-center gap-3">
                {leftContent}
            </div>
            {centerContent && (
                <div className="min-w-0 flex-1 sm:order-none">
                    {centerContent}
                </div>
            )}
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                {hasExisting && onDelete && (
                    <button
                        onClick={() => { void onDelete(); }}
                        disabled={deleteDisabled || isSaving || isDeleting}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-3 text-[10px] font-black uppercase tracking-widest text-destructive-foreground shadow-xl shadow-destructive/20 transition-all hover:bg-destructive/90 disabled:opacity-70 sm:min-w-[10rem] sm:w-auto sm:px-6"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </button>
                )}
                {showCancel && onCancel && (
                    <button
                        onClick={() => { void onCancel(); }}
                        disabled={isSaving || isDeleting}
                        className="min-h-11 w-full rounded-2xl border border-content bg-card px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground transition-all hover:bg-muted/50 disabled:opacity-70 sm:min-w-[9rem] sm:w-auto sm:px-6"
                    >
                        {cancelLabel}
                    </button>
                )}
                <button
                    onClick={() => { void onSave(); }}
                    disabled={saveDisabled || isSaving}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-70 sm:min-w-[10rem] sm:w-auto sm:px-6"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : (saveLabel || (hasExisting ? 'Edit' : 'Save'))}
                </button>
            </div>
        </div>
    );
};

export default AutomationActionBar;
