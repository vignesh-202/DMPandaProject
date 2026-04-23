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
        <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
            <div className="flex items-center gap-3 min-w-0">
                {leftContent}
            </div>
            {centerContent && (
                <div className="min-w-0 flex-1">
                    {centerContent}
                </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
                {hasExisting && onDelete && (
                    <button
                        onClick={() => { void onDelete(); }}
                        disabled={deleteDisabled || isSaving || isDeleting}
                        className="px-6 py-3 bg-destructive text-destructive-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-destructive/90 transition-all shadow-xl shadow-destructive/20 flex items-center gap-2 disabled:opacity-70"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </button>
                )}
                {showCancel && onCancel && (
                    <button
                        onClick={() => { void onCancel(); }}
                        disabled={isSaving || isDeleting}
                        className="px-6 py-3 rounded-2xl border border-content bg-card text-[10px] font-black uppercase tracking-widest text-foreground transition-all hover:bg-muted/50 disabled:opacity-70"
                    >
                        {cancelLabel}
                    </button>
                )}
                <button
                    onClick={() => { void onSave(); }}
                    disabled={saveDisabled || isSaving}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-70"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving...' : (saveLabel || (hasExisting ? 'Edit' : 'Save'))}
                </button>
            </div>
        </div>
    );
};

export default AutomationActionBar;
