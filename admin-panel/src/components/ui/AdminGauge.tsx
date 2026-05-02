import React from 'react';
import { cn } from '../../lib/utils';
import Gauge from './gauge';

interface AdminGaugeProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  helper?: string;
  className?: string;
  compact?: boolean;
}

export const AdminGauge: React.FC<AdminGaugeProps> = ({
  value,
  max,
  label,
  sublabel,
  helper,
  className,
  compact = false
}) => {
  const safeMax = Math.max(Number(max || 0), 1);
  const safeValue = Math.max(0, Number(value || 0));
  const updatedText = helper || `${safeValue.toLocaleString('en-IN')}/${safeMax.toLocaleString('en-IN')} in use`;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-[28px] border border-border/70 bg-background/60 shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
      compact ? 'min-h-[250px] p-4' : 'min-h-[280px] p-5 sm:p-6',
      className
    )}>
      <div className="flex h-full flex-col">
        <div className="pr-10 min-h-[52px]">
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
          {sublabel ? <p className="text-xs font-medium leading-5 text-muted-foreground mt-1">{sublabel}</p> : null}
        </div>
        <div className="flex flex-1 items-center justify-center px-2 pt-3">
          <Gauge
            value={safeValue}
            max={safeMax}
            size="lg"
            syncId="dashboard-gauges"
            updatedText={helper ? '' : updatedText}
          />
        </div>
        {helper && (
          <div className="mt-auto pt-4">
            <p className="text-center text-[10px] font-medium leading-4 text-muted-foreground sm:text-xs">
              {helper}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGauge;
