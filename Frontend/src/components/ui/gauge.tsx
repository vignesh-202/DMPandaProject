import React, { Suspense, lazy, useRef, useEffect, useState } from 'react';

const GaugeChart = lazy(() => import('react-gauge-chart'));

interface GaugeProps {
  value: number;
  max?: number;
  startAnimation?: boolean;
  invertColor?: boolean;
}

const Gauge = ({ value, max = 100, startAnimation = false, invertColor = false }: GaugeProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    if (!chartRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width);
        }
      }
    });
    resizeObserver.observe(chartRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (startAnimation) {
      const targetPercent = value ? Math.max(0, Math.min(value, max)) / max : 0;
      const duration = 2000; // 2 seconds for full effect

      let startTime: number;
      let animationFrameId: number;

      const animate = (time: number) => {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);

        // Custom easing: easeOutQuart
        // const ease = 1 - Math.pow(1 - progress, 4);

        // Logic: Sweep to 100% then settle at target
        // We want the needle to go up to 1 (or near it) then back to target.
        // Let's model it as a damped spring or just a simple keyframe interpolation.
        // Simple approach: 
        // 0% -> 50% of time: go 0 -> 1
        // 50% -> 100% of time: go 1 -> target

        let currentVal;
        if (progress < 0.5) {
          // First half: 0 -> 1
          const p = progress * 2; // 0 to 1
          const e = 1 - Math.pow(1 - p, 3); // cubic ease out
          currentVal = e;
        } else {
          // Second half: 1 -> target
          const p = (progress - 0.5) * 2; // 0 to 1
          const e = 1 - Math.pow(1 - p, 3);
          currentVal = 1 - (1 - targetPercent) * e;
        }

        setAnimatedPercent(currentVal);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => cancelAnimationFrame(animationFrameId);
    } else {
      setAnimatedPercent(0);
    }
  }, [startAnimation, value, max]);

  const percent = Math.max(0, Math.min(animatedPercent, 1));

  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);
    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const getColor = () => {
    // Standard: Red (0) -> Yellow (0.5) -> Green (1)
    // Inverted: Green (0) -> Yellow (0.5) -> Red (1)

    if (invertColor) {
      if (percent <= 0.5) {
        // Green to Yellow
        return interpolateColor('#86efac', '#fde047', percent * 2);
      } else {
        // Yellow to Red
        return interpolateColor('#fde047', '#f87171', (percent - 0.5) * 2);
      }
    } else {
      if (percent <= 0.5) {
        // Red to Yellow
        return interpolateColor('#f87171', '#fde047', percent * 2);
      } else {
        // Yellow to Green
        return interpolateColor('#fde047', '#86efac', (percent - 0.5) * 2);
      }
    }
  };

  const color = getColor();

  const getGlowStyle = () => {
    const style: React.CSSProperties = {
      filter: `drop-shadow(0 0 5px ${color})`,
      transition: 'filter 0.3s ease',
    };
    return style;
  };

  return (
    <div ref={chartRef} style={getGlowStyle()} className="w-full flex justify-center items-center">
      <Suspense fallback={<div className="h-40 w-full animate-pulse bg-gray-200 dark:bg-gray-800 rounded-lg"></div>}>
        {width > 0 && (
          <GaugeChart
            id={`gauge-chart-${Math.random()}`}
            nrOfLevels={20}
            colors={[color, '#e0e0e0']}
            arcWidth={0.3}
            percent={percent}
            needleColor="#000000"
            needleBaseColor="#000000"
            textColor={color}
            style={{ width: '100%', height: 'auto' }}
            animate={false} // We handle animation manually
          />
        )}
      </Suspense>
    </div>
  );
};

export default Gauge;
