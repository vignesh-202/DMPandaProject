import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showNeedle?: boolean;
  syncId?: string;
  updatedText?: string;
  className?: string;
}

const syncState: Record<string, { startTime: number; animating: boolean }> = {};

const Gauge: React.FC<GaugeProps> = ({
  value,
  max = 100,
  label,
  size = 'md',
  showNeedle = true,
  syncId,
  updatedText = 'Updated 1 day ago',
  className
}) => {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const requestRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const targetValue = Math.min(Math.max(value, 0), max);
  const targetPercent = max > 0 ? (targetValue / max) * 100 : 0;

  useLayoutEffect(() => {
    mountedRef.current = true;
    const duration = 1500;
    const syncKey = syncId || 'default';

    if (!syncState[syncKey] || !syncState[syncKey].animating) {
      syncState[syncKey] = { startTime: performance.now(), animating: true };
    }
    const startTime = syncState[syncKey].startTime;

    const animate = (now: number) => {
      if (!mountedRef.current) return;
      const elapsed = now - startTime;
      if (elapsed < duration) {
        const progress = elapsed / duration;
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedPercent(eased * targetPercent);
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setAnimatedPercent(targetPercent);
        if (syncState[syncKey]) syncState[syncKey].animating = false;
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      mountedRef.current = false;
      if (requestRef.current != null) cancelAnimationFrame(requestRef.current);
    };
  }, [targetPercent, syncId]);

  const sizes = {
    sm: { container: 'w-full max-w-[160px]', valueSize: 'text-xl sm:text-2xl', labelSize: 'text-2xs' },
    md: { container: 'w-full max-w-[220px]', valueSize: 'text-2xl sm:text-3xl', labelSize: 'text-2xs sm:text-xs' },
    lg: { container: 'w-full max-w-[280px]', valueSize: 'text-3xl sm:text-4xl', labelSize: 'text-xs' }
  };
  const s = sizes[size];

  const center = 100;
  const radius = 80;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;

  const getPos = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad)
    };
  };

  const createArcPath = (start: number, end: number, r: number) => {
    const p1 = getPos(start, r);
    const p2 = getPos(end, r);
    const largeArc = end - start <= 180 ? 0 : 1;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
  };

  const currentAngle = startAngle + ((animatedPercent / 100) * totalAngle);
  const needlePos = getPos(currentAngle, radius - 10);

  const getActivityColor = (percent: number) => {
    const stops = [
      { pos: 0, color: [34, 197, 94] },
      { pos: 25, color: [34, 197, 94] },
      { pos: 25.01, color: [234, 179, 8] },
      { pos: 50, color: [234, 179, 8] },
      { pos: 50.01, color: [249, 115, 22] },
      { pos: 75, color: [249, 115, 22] },
      { pos: 75.01, color: [239, 68, 68] },
      { pos: 100, color: [239, 68, 68] }
    ];

    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (percent >= stops[i].pos && percent <= stops[i + 1].pos) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    const range = upper.pos - lower.pos;
    const factor = range === 0 ? 0 : (percent - lower.pos) / range;
    const r = Math.round(lower.color[0] + ((upper.color[0] - lower.color[0]) * factor));
    const g = Math.round(lower.color[1] + ((upper.color[1] - lower.color[1]) * factor));
    const b = Math.round(lower.color[2] + ((upper.color[2] - lower.color[2]) * factor));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const percent = animatedPercent;
  const mainColor = getActivityColor(percent);
  let activityLabel = 'QUIET';
  if (percent >= 25 && percent < 50) activityLabel = 'ACTIVE';
  else if (percent >= 50 && percent < 75) activityLabel = 'BUSY';
  else if (percent >= 75) activityLabel = 'PEAK';

  const displayValue = Number(targetValue || 0).toLocaleString('en-IN');
  const displayMax = Number(max || 0).toLocaleString('en-IN');

  return (
    <div className={cn(`gauge-legacy mx-auto flex select-none flex-col items-center justify-center ${s.container}`, className)}>
      <div className="relative w-full aspect-square">
        <svg viewBox="0 0 200 180" className="h-full w-full overflow-visible">
          <defs>
            <path id="pathQuiet" d={createArcPath(-210, -165, radius + 15)} fill="none" />
            <path id="pathActive" d={createArcPath(-155, -100, radius + 15)} fill="none" />
            <path id="pathBusy" d={createArcPath(-80, -25, radius + 15)} fill="none" />
            <path id="pathPeak" d={createArcPath(-15, 35, radius + 15)} fill="none" />
            <filter id="needleGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="igGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#405DE6" />
              <stop offset="25%" stopColor="#833AB4" />
              <stop offset="50%" stopColor="#FD1D1D" />
              <stop offset="75%" stopColor="#F56040" />
              <stop offset="100%" stopColor="#FCAF45" />
            </linearGradient>
            <filter id="igGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={createArcPath(-210, -160, radius + 15)} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
          <path d={createArcPath(-160, -90, radius + 15)} fill="none" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
          <path d={createArcPath(-90, -20, radius + 15)} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
          <path d={createArcPath(-20, 30, radius + 15)} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />

          <text className="fill-[#22c55e] text-[7px] font-bold tracking-[2px] uppercase">
            <textPath href="#pathQuiet" startOffset="50%" textAnchor="middle">QUIET</textPath>
          </text>
          <text className="fill-[#eab308] text-[7px] font-bold tracking-[2px] uppercase">
            <textPath href="#pathActive" startOffset="50%" textAnchor="middle">ACTIVE</textPath>
          </text>
          <text className="fill-[#f97316] text-[7px] font-bold tracking-[2px] uppercase">
            <textPath href="#pathBusy" startOffset="50%" textAnchor="middle">BUSY</textPath>
          </text>
          <text className="fill-[#ef4444] text-[7px] font-bold tracking-[2px] uppercase">
            <textPath href="#pathPeak" startOffset="50%" textAnchor="middle">PEAK</textPath>
          </text>

          <path d={createArcPath(startAngle, endAngle, radius)} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" className="text-muted/30" />
          <path
            d={createArcPath(startAngle, currentAngle, radius)}
            fill="none"
            stroke="url(#igGaugeGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#igGlow)"
          />

          {showNeedle && (
            <g filter="url(#needleGlow)">
              <line
                x1={center}
                y1={center}
                x2={needlePos.x}
                y2={needlePos.y}
                stroke={mainColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx={center} cy={center} r="6" fill={mainColor} />
            </g>
          )}

          {label ? (
            <text x="100" y="70" textAnchor="middle" className="fill-muted-foreground text-[8px] font-bold uppercase tracking-[2px]">
              {label}
            </text>
          ) : null}
          <text x="100" y="103" textAnchor="middle" className={cn('fill-foreground font-[900]', s.valueSize)}>
            {displayValue}
          </text>
          <text x="100" y="122" textAnchor="middle" className="fill-muted-foreground text-[9px] font-semibold">
            of {displayMax}
          </text>
          <text x="100" y="142" textAnchor="middle" className={cn('font-bold tracking-[2px] uppercase', s.labelSize)} fill={mainColor}>
            {activityLabel}
          </text>
        </svg>
      </div>
      <p className="mt-2 text-center text-xs font-medium text-muted-foreground">{updatedText}</p>
    </div>
  );
};

export default Gauge;
