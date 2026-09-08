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
            <div className="flex min-w-0 items-center gap-3 flex-1">
                {leftContent}
                {centerContent && (
                    <div className="min-w-0 flex-1">
                        {centerContent}
                    </div>
                )}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:items-center sm:justify-end sm:gap-2.5">
                {hasExisting && onDelete && (
                    <button
                        onClick={() => { void onDelete(); }}
                        disabled={deleteDisabled || isSaving || isDeleting}
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </button>
                )}
                {showCancel && onCancel && (
                    <button
                        onClick={() => { void onCancel(); }}
                        disabled={isSaving || isDeleting}
                        className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted/60 text-foreground transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {cancelLabel}
                    </button>
                )}
                <button
                    onClick={() => { void onSave(); }}
                    disabled={saveDisabled || isSaving}
                    className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white hover:opacity-95 shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : (saveLabel || (hasExisting ? 'Save Changes' : 'Save'))}
                </button>
            </div>
        </div>
    );
};

export default AutomationActionBar;
