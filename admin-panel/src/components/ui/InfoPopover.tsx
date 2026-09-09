import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

export interface RateLimitItem {
  label: string;
  limit: string;
  detail?: string;
}

export interface InfoPopoverProps {
  title: string;
  description?: string;
  formula?: string;
  notes?: string[];
  rateLimits?: RateLimitItem[];
  badge?: string;
  className?: string;
}

const InfoPopover: React.FC<InfoPopoverProps> = ({
  title,
  description,
  formula,
  notes = [],
  rateLimits = [],
  badge,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={`Explain ${title}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 shadow-xs transition-all duration-150 hover:border-primary/50 hover:text-primary hover:bg-gray-50 dark:hover:bg-neutral-700 active:scale-95"
        title="View Meta rate limits summary"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-64 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 opacity-100">
          <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{title}</span>
              {badge && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                  {badge}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0"
              aria-label="Close popover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {description && (
            <p className="mt-1.5 text-[11px] leading-snug text-gray-600 dark:text-gray-300">{description}</p>
          )}

          {rateLimits.length > 0 && (
            <div className="mt-2 divide-y divide-gray-100 dark:divide-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 px-2.5 py-0.5 text-[11px]">
              {rateLimits.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{item.label}</span>
                  <span className="font-bold text-gray-950 dark:text-white text-right">{item.limit}</span>
                </div>
              ))}
            </div>
          )}

          {formula && (
            <p className="mt-1.5 text-[10px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-950 px-2 py-1 rounded border border-gray-200 dark:border-neutral-800 font-mono leading-tight">
              {formula}
            </p>
          )}

          {notes.length > 0 && (
            <div className="mt-1.5 space-y-1 text-[10px] text-gray-600 dark:text-gray-400">
              {notes.map((note, idx) => (
                <p key={idx} className="leading-snug flex items-start gap-1">
                  <span className="text-primary font-bold">•</span>
                  <span>{note}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InfoPopover;
