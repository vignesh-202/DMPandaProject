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
    showSave?: boolean;
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
    showSave = true,
    saveLabel
}) => {
    return (
        <div className={`flex flex-row items-center justify-between gap-2.5 sm:gap-3 flex-wrap ${className}`.trim()}>
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 flex-1">
                {leftContent}
                {centerContent && (
                    <div className="min-w-0 flex-1">
                        {centerContent}
                    </div>
                )}
            </div>
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                {hasExisting && onDelete && (
                    <button
                        type="button"
                        onClick={() => { void onDelete(); }}
                        disabled={deleteDisabled || isSaving || isDeleting}
                        title="Delete automation"
                        aria-label="Delete automation"
                        className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 px-2.5 sm:px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span className="hidden sm:inline">Delete</span>
                    </button>
                )}
                {showCancel && onCancel && (
                    <button
                        type="button"
                        onClick={() => { void onCancel(); }}
                        disabled={isSaving || isDeleting}
                        className="inline-flex h-9 sm:h-10 items-center justify-center px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium border border-border bg-card hover:bg-muted/60 text-foreground transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {cancelLabel}
                    </button>
                )}
                {showSave && (
                    <button
                        type="button"
                        onClick={() => { void onSave(); }}
                        disabled={saveDisabled || isSaving}
                        className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 px-3.5 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white hover:opacity-95 shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        <span>{isSaving ? 'Saving...' : (saveLabel || (hasExisting ? 'Save Changes' : 'Save'))}</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default AutomationActionBar;
