import React from 'react';
import { cn } from '../../lib/utils';
import Gauge from './gauge';
import InfoPopover from './InfoPopover';

interface AdminGaugeProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  helper?: string;
  helperBelowValue?: string;
  className?: string;
  compact?: boolean;
  infoDescription?: string;
  infoFormula?: string;
  infoNotes?: string[];
}

export const AdminGauge: React.FC<AdminGaugeProps> = ({
  value,
  max,
  label,
  sublabel,
  helper,
  helperBelowValue,
  className,
  compact = false,
  infoDescription,
  infoFormula,
  infoNotes
}) => {
  const safeMax = Math.max(Number(max || 0), 1);
  const safeValue = Math.max(0, Number(value || 0));
  const ratioText = `${safeValue.toLocaleString('en-IN')}/${safeMax.toLocaleString('en-IN')}`;
  const gaugeText = helperBelowValue || '';

  return (
    <div className={cn(
      'relative overflow-hidden rounded-[28px] border border-border/70 bg-background/60 shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
      compact ? 'min-h-[250px] p-4' : 'min-h-[280px] p-5 sm:p-6',
      className
    )}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 min-h-[52px]">
          <div className="pr-2">
            <h3 className="text-sm font-bold text-foreground">{label}</h3>
            {sublabel ? <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{sublabel}</p> : null}
          </div>
          {infoDescription ? (
            <InfoPopover
              title={label}
              description={infoDescription}
              formula={infoFormula}
              notes={infoNotes}
              className="shrink-0"
            />
          ) : null}
        </div>
        <div className="flex flex-1 items-center justify-center px-2 pt-3">
          <Gauge
            value={safeValue}
            max={safeMax}
            size="lg"
            syncId="dashboard-gauges"
            updatedText={gaugeText}
          />
        </div>
        <div className="mt-auto pt-3 text-center">
          <p className="text-base font-black tracking-tight text-foreground sm:text-lg">
            {ratioText}
          </p>
          {helper && (
            <p className="mt-2 text-center text-[10px] font-medium leading-4 text-muted-foreground sm:text-xs">
              {helper}
            </p>
          )}
        </div>
        {!helper && helperBelowValue && (
          <div className="pt-2">
            <p className="text-center text-[10px] font-medium leading-4 text-muted-foreground sm:text-xs">
              {helperBelowValue}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGauge;
