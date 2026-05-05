import React, { useEffect, useId, useRef, useState } from 'react';
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

// Global sync state for coordinated intro animations
const syncState: Record<string, { startTime: number; expiresAt: number; active: boolean }> = {};

const INTRO_DURATION_MS = 2400;
const VALUE_UPDATE_DURATION_MS = 700;
const VISIBILITY_THRESHOLD = 0.35;

const easeInOutCubic = (progress: number): number => {
  if (progress <= 0.5) {
    return 4 * progress * progress * progress;
  }
  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
};

const getIntroPercent = (progress: number, targetPercent: number): number => {
  if (progress <= 0.4) {
    return easeInOutCubic(progress / 0.4) * 100;
  }

  if (progress <= 0.78) {
    return (1 - easeInOutCubic((progress - 0.4) / 0.38)) * 100;
  }

  return easeInOutCubic((progress - 0.78) / 0.22) * targetPercent;
};

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const currentPercentRef = useRef(0);
  const introPlayedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useRef(false);
  const id = useId();

  // Normalize target value
  const targetValue = Math.min(Math.max(value, 0), max);
  const targetPercent = max > 0 ? (targetValue / max) * 100 : 0;

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== 'undefined') {
      prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    return () => {
      mountedRef.current = false;
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD);
      },
      {
        threshold: [0, VISIBILITY_THRESHOLD, 0.6],
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    currentPercentRef.current = animatedPercent;
  }, [animatedPercent]);

  useEffect(() => {
    if (!mountedRef.current || !isVisible) return;

    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    if (prefersReducedMotion.current) {
      introPlayedRef.current = true;
      currentPercentRef.current = targetPercent;
      setAnimatedPercent(targetPercent);
      return;
    }

    const animateBetween = (from: number, to: number, duration: number) => {
      const startTime = performance.now();

      const step = (now: number) => {
        if (!mountedRef.current) return;

        const progress = Math.min((now - startTime) / duration, 1);
        const nextPercent = from + ((to - from) * easeInOutCubic(progress));
        currentPercentRef.current = nextPercent;
        setAnimatedPercent(nextPercent);

        if (progress < 1) {
          requestRef.current = requestAnimationFrame(step);
          return;
        }

        requestRef.current = null;
      };

      requestRef.current = requestAnimationFrame(step);
    };

    if (!introPlayedRef.current) {
      const syncKey = syncId || `gauge-${id}`;
      const now = performance.now();
      const existing = syncState[syncKey];
      const shouldStartNewSequence = !existing || !existing.active || existing.expiresAt <= now;

      if (shouldStartNewSequence) {
        syncState[syncKey] = {
          startTime: now,
          expiresAt: now + INTRO_DURATION_MS + 250,
          active: true,
        };
      }

      const startTime = syncState[syncKey].startTime;

      const step = (frameNow: number) => {
        if (!mountedRef.current) return;

        const progress = Math.min((frameNow - startTime) / INTRO_DURATION_MS, 1);
        const nextPercent = getIntroPercent(progress, targetPercent);
        currentPercentRef.current = nextPercent;
        setAnimatedPercent(nextPercent);

        if (progress < 1) {
          requestRef.current = requestAnimationFrame(step);
          return;
        }

        introPlayedRef.current = true;
        currentPercentRef.current = targetPercent;
        setAnimatedPercent(targetPercent);
        requestRef.current = null;

        if (syncState[syncKey] && syncState[syncKey].startTime === startTime) {
          syncState[syncKey].active = false;
        }
      };

      requestRef.current = requestAnimationFrame(step);
      return;
    }

    if (Math.abs(currentPercentRef.current - targetPercent) > 0.05) {
      animateBetween(currentPercentRef.current, targetPercent, VALUE_UPDATE_DURATION_MS);
    }
  }, [id, isVisible, syncId, targetPercent]);

  // Size configurations
  const sizes = {
    sm: { container: 'w-full max-w-[160px]', valueSize: 'text-xl sm:text-2xl', labelSize: 'text-2xs' },
    md: { container: 'w-full max-w-[220px]', valueSize: 'text-2xl sm:text-3xl', labelSize: 'text-2xs sm:text-xs' },
    lg: { container: 'w-full max-w-[280px]', valueSize: 'text-3xl sm:text-4xl', labelSize: 'text-xs' }
  };
  const s = sizes[size];

  // SVG Geometry
  const center = 100;
  const radius = 80;
  const strokeWidth = 14;

  // Arc angles: 210 degrees from 7 o'clock to 5 o'clock
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

  // Calculate angle and position based on current animated percent
  const currentAngle = startAngle + (animatedPercent / 100) * totalAngle;
  const needlePos = getPos(currentAngle, radius - 10);

  // Activity-based color system: Green → Yellow → Orange → Red
  const percent = animatedPercent;
  
  // Get color based on activity level with smooth transitions
  const getActivityColor = (p: number): string => {
    // Color stops: Green (QUIET) → Yellow (ACTIVE) → Orange (BUSY) → Red (PEAK)
    const stops = [
      { pos: 0, color: [34, 197, 94] },     // Green #22c55e - QUIET start
      { pos: 25, color: [34, 197, 94] },    // Green #22c55e - QUIET end
      { pos: 25.01, color: [234, 179, 8] }, // Yellow #eab308 - ACTIVE start
      { pos: 50, color: [234, 179, 8] },    // Yellow #eab308 - ACTIVE end
      { pos: 50.01, color: [249, 115, 22] },// Orange #f97316 - BUSY start
      { pos: 75, color: [249, 115, 22] },   // Orange #f97316 - BUSY end
      { pos: 75.01, color: [239, 68, 68] }, // Red #ef4444 - PEAK start
      { pos: 100, color: [239, 68, 68] }    // Red #ef4444 - PEAK end
    ];
    
    // Find the two stops to interpolate between
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    
    for (let i = 0; i < stops.length - 1; i++) {
      if (p >= stops[i].pos && p <= stops[i + 1].pos) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }
    
    // Interpolate for smooth transition
    const range = upper.pos - lower.pos;
    const factor = range === 0 ? 0 : (p - lower.pos) / range;
    
    const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * factor);
    const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * factor);
    const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
  };
  
  const mainColor = getActivityColor(percent);
  
  // Activity-based labels
  let activityLabel = 'QUIET';
  if (percent >= 25 && percent < 50) activityLabel = 'ACTIVE';
  else if (percent >= 50 && percent < 75) activityLabel = 'BUSY';
  else if (percent >= 75) activityLabel = 'PEAK';
  
  const colorInfo = { main: mainColor, label: activityLabel };

  const quietPathId = `${id}-quiet`;
  const activePathId = `${id}-active`;
  const busyPathId = `${id}-busy`;
  const peakPathId = `${id}-peak`;
  const igGlowId = `${id}-ig-glow`;

  return (
    <div ref={containerRef} className={cn(`gauge-legacy flex flex-col items-center justify-center mx-auto select-none ${s.container}`, className)}>
      <div className="relative w-full aspect-square">
        <svg viewBox="0 0 200 180" className="w-full h-full overflow-visible">
          <defs>
            {/* Curved paths for text labels */}
            <path id={quietPathId} d={createArcPath(-210, -165, radius + 15)} fill="none" />
            <path id={activePathId} d={createArcPath(-155, -100, radius + 15)} fill="none" />
            <path id={busyPathId} d={createArcPath(-80, -25, radius + 15)} fill="none" />
            <path id={peakPathId} d={createArcPath(-15, 35, radius + 15)} fill="none" />
            
            {/* Glow filter for Instagram effect */}
            <filter id={igGlowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

          </defs>

          {/* Outer Boundary Arcs - Activity Colors */}
          <path 
            d={createArcPath(-210, -160, radius + 15)} 
            fill="none" 
            stroke="#22c55e" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeOpacity="0.4"
          />
          <path 
            d={createArcPath(-160, -90, radius + 15)} 
            fill="none" 
            stroke="#eab308" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeOpacity="0.4"
          />
          <path 
            d={createArcPath(-90, -20, radius + 15)} 
            fill="none" 
            stroke="#f97316" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeOpacity="0.4"
          />
          <path 
            d={createArcPath(-20, 30, radius + 15)} 
            fill="none" 
            stroke="#ef4444" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeOpacity="0.4"
          />

          {/* Tick marks - Activity colors */}
          {[-160, -90, -20, 30].map((tickAngle, i) => {
            const p1 = getPos(tickAngle, radius + 13);
            const p2 = getPos(tickAngle, radius + 17);
            const tickColors = ['#eab308', '#f97316', '#ef4444', '#ef4444'];
            return (
              <line
                key={tickAngle}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={tickColors[i]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeOpacity="0.6"
              />
            );
          })}

          {/* Labels - Activity colors, hidden on small viewports to prevent overlap with value number */}
          <text fill="#22c55e" fontSize="6" fontWeight="700" letterSpacing="0.02em" className="opacity-80 [@media(max-width:360px)]:hidden">
            <textPath href={`#${quietPathId}`} startOffset="50%" textAnchor="middle">QUIET</textPath>
          </text>
          <text fill="#eab308" fontSize="6" fontWeight="700" letterSpacing="0.05em" className="opacity-80 [@media(max-width:360px)]:hidden">
            <textPath href={`#${activePathId}`} startOffset="50%" textAnchor="middle">ACTIVE</textPath>
          </text>
          <text fill="#f97316" fontSize="6" fontWeight="700" letterSpacing="0.05em" className="opacity-80 [@media(max-width:360px)]:hidden">
            <textPath href={`#${busyPathId}`} startOffset="50%" textAnchor="middle">BUSY</textPath>
          </text>
          <text fill="#ef4444" fontSize="6" fontWeight="700" letterSpacing="0.02em" className="opacity-80 [@media(max-width:360px)]:hidden">
            <textPath href={`#${peakPathId}`} startOffset="50%" textAnchor="middle">PEAK</textPath>
          </text>

          {/* Main Gray Background Arc */}
          <path
            d={createArcPath(startAngle, endAngle, radius)}
            fill="none"
            className="stroke-muted"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress Arc Background Glow */}
          {animatedPercent > 0 && (
            <path
              d={createArcPath(startAngle, currentAngle, radius)}
              fill="none"
              stroke={mainColor}
              strokeWidth={strokeWidth + 4}
              strokeOpacity="0.15"
              strokeLinecap="round"
            />
          )}

          {/* Main Progress Arc - with glow effect using gauge level color */}
          <path
            d={createArcPath(startAngle, currentAngle, radius)}
            fill="none"
            stroke={mainColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${mainColor}) drop-shadow(0 0 10px ${mainColor}CC) drop-shadow(0 0 14px ${mainColor}99)`,
              transition: 'filter 0.3s ease, stroke 0.3s ease',
            }}
          />

          {/* Needle - Enhanced with Instagram glow */}
          {showNeedle && (
            <g filter={`url(#${igGlowId})`}>
              <line
                x1={center} y1={center}
                x2={needlePos.x} y2={needlePos.y}
                stroke={mainColor}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle
                cx={center} cy={center}
                r="7" 
                fill={mainColor}
                className="stroke-card"
                strokeWidth="2.5"
              />
              {/* Inner highlight */}
              <circle
                cx={center} cy={center}
                r="3"
                fill="white"
                fillOpacity="0.3"
              />
            </g>
          )}
        </svg>

        {/* Value Overlay - Enhanced typography, extra bottom padding on mobile to avoid overlap with arc labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 sm:pb-4 md:pb-3">
          <div 
            className={cn("font-black leading-tight tracking-tight drop-shadow-sm", s.valueSize)}
            style={{ 
              color: mainColor,
              textShadow: `0 0 20px ${mainColor}40`
            }}
          >
            {((animatedPercent / 100) * max).toFixed(2)}
          </div>
          <div className="text-muted-foreground font-semibold text-2xs sm:text-xs mt-1.5 sm:mt-1 uppercase tracking-wide">
            {updatedText}
          </div>
          {label && (
            <div className="absolute top-0 text-2xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Gauge;
