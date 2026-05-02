import React from 'react';
import ToggleSwitch from './ToggleSwitch';

interface LockedFeatureToggleProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
    locked: boolean;
    note: string;
    onUpgrade: () => void;
    activeIconClassName?: string;
    actionElement?: React.ReactNode;
}

const LockedFeatureToggle: React.FC<LockedFeatureToggleProps> = ({
    icon,
    title,
    description,
    checked,
    onToggle,
    locked,
    note,
    onUpgrade,
    activeIconClassName = 'text-primary',
    actionElement
}) => (
    <div className={`rounded-[28px] border p-5 transition-all ${locked ? 'border-amber-300/70 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-content/70 bg-muted/40 hover:bg-muted/55'} ${checked && !locked ? 'ring-1 ring-primary/15' : ''}`}>
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className={`rounded-2xl border p-3 shadow-sm ${checked && !locked ? 'bg-white dark:bg-gray-900 border-primary/15' : locked ? 'border-amber-300/70 bg-amber-100/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className={checked && !locked ? activeIconClassName : ''}>{icon}</div>
                </div>
                <div>
                    <p className="mb-0.5 text-[11px] font-black uppercase tracking-[0.15em] text-foreground">{title}</p>
                    <p className="text-[10px] font-medium text-muted-foreground">{description}</p>
                </div>
            </div>
            {locked ? (
                <button
                    type="button"
                    onClick={onUpgrade}
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-amber-400 bg-amber-300 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-950 shadow-sm transition hover:bg-amber-200"
                >
                    Upgrade
                </button>
            ) : actionElement ? (
                actionElement
            ) : (
                <ToggleSwitch
                    isChecked={checked}
                    onChange={onToggle}
                    variant="plain"
                />
            )}
        </div>
        {locked ? (
            <p className="mt-3 text-[10px] font-semibold text-amber-800 dark:text-amber-200">{note}</p>
        ) : null}
    </div>
);

export default LockedFeatureToggle;
