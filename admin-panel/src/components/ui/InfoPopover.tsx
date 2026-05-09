import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoPopoverProps {
  title: string;
  description: string;
  formula?: string;
  notes?: string[];
  className?: string;
}

const InfoPopover: React.FC<InfoPopoverProps> = ({
  title,
  description,
  formula,
  notes = [],
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Info className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.55rem)] z-30 w-[min(21rem,calc(100vw-2rem))] rounded-[1.35rem] border border-border/80 bg-card/95 p-4 shadow-[0_26px_65px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
          {formula ? (
            <div className="mt-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Formula</p>
              <p className="mt-1 text-xs font-semibold text-foreground">{formula}</p>
            </div>
          ) : null}
          {notes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {notes.map((note) => (
                <p key={note} className="text-[11px] leading-5 text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default InfoPopover;
