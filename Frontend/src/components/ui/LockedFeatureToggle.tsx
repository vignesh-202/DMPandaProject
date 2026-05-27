import React from 'react';
import ToggleSwitch from './ToggleSwitch';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LockedFeatureToggleProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
    locked?: boolean;
    note?: string;
    onUpgrade?: () => void;
    activeIconClassName?: string;
    actionElement?: React.ReactNode;
    isCollapsed?: boolean;
    onCollapseToggle?: () => void;
}

const LockedFeatureToggle: React.FC<LockedFeatureToggleProps> = ({
    icon,
    title,
    description,
    checked,
    onToggle,
    locked = false,
    note = '',
    onUpgrade = () => {},
    activeIconClassName = 'text-primary',
    actionElement,
    isCollapsed = false,
    onCollapseToggle
}) => (
    <div className={`rounded-[22px] border p-4 transition-all sm:rounded-[28px] sm:p-5 ${locked ? 'border-amber-300/70 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-content/70 bg-muted/40 hover:bg-muted/55'} ${checked && !locked ? 'ring-1 ring-primary/15' : ''}`}>
        <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4 min-w-0 flex-1">
                <div className={`rounded-xl border p-2.5 shadow-sm sm:rounded-2xl sm:p-3 shrink-0 ${checked && !locked ? 'bg-white dark:bg-gray-900 border-primary/15' : locked ? 'border-amber-300/70 bg-amber-100/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className={checked && !locked ? activeIconClassName : ''}>{icon}</div>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-foreground sm:text-[11px] sm:tracking-[0.15em]">{title}</p>
                    <p className="text-[11px] leading-5 text-muted-foreground sm:text-[10px] sm:leading-normal">{description}</p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {locked ? (
                    <button
                        type="button"
                        onClick={onUpgrade}
                        className="inline-flex min-h-[2.25rem] items-center justify-center rounded-xl border border-amber-400 bg-amber-300 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-950 shadow-sm transition hover:bg-amber-200"
                    >
                        Upgrade
                    </button>
                ) : actionElement ? (
                    actionElement
                ) : (
                    <>
                        {checked && onCollapseToggle && (
                            <button
                                type="button"
                                onClick={onCollapseToggle}
                                className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-gray-800/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                {isCollapsed ? (
                                    <ChevronDown className="w-5.5 h-5.5" />
                                ) : (
                                    <ChevronUp className="w-5.5 h-5.5" />
                                )}
                            </button>
                        )}
                        <ToggleSwitch
                            isChecked={checked}
                            onChange={onToggle}
                            variant="plain"
                        />
                    </>
                )}
            </div>
        </div>
        {locked ? (
            <p className="mt-3 text-[10px] font-semibold text-amber-800 dark:text-amber-200">{note}</p>
        ) : null}
    </div>
);

export default LockedFeatureToggle;
