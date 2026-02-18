import React, { useEffect, useState, useMemo } from 'react';

interface GaugeProps {
    value: number;
    max?: number;
    startAnimation?: boolean;
    invertColor?: boolean;
    showValue?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const Gauge: React.FC<GaugeProps> = ({
    value,
    max = 100,
    startAnimation = false,
    invertColor = false,
    showValue = false,
    size = 'md',
    className = ""
}) => {
    const [animatedValue, setAnimatedValue] = useState(0);

    // Normalize value between 0 and 1
    const normalizedValue = Math.min(Math.max(value / max, 0), 1);

    // Determine color based on value - Instagram gradient inspired
    const getColor = useMemo(() => {
        const percent = invertColor ? 1 - animatedValue : animatedValue;
        if (percent >= 0.7) return { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' }; // Green
        if (percent >= 0.4) return { color: '#eab308', glow: 'rgba(234, 179, 8, 0.4)' }; // Yellow
        return { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' }; // Red
    }, [animatedValue, invertColor]);

    useEffect(() => {
        if (startAnimation) {
            let start: number;
            const duration = 1500;
            const finalValue = normalizedValue;

            const animate = (timestamp: number) => {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

                const currentProgress = Math.min(progress / duration, 1);
                const easedProgress = easeOutQuart(currentProgress);

                setAnimatedValue(easedProgress * finalValue);

                if (progress < duration) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        } else {
            setAnimatedValue(0);
        }
    }, [value, max, startAnimation, normalizedValue]);

    // SVG Configuration
    const radius = 80;
    const strokeWidth = 14;
    const circumference = Math.PI * radius;
    const arcLength = circumference * animatedValue;
    
    // Needle angle calculation (0 = left, 180 = right)
    const needleAngle = animatedValue * 180;

    // Tick marks for the gauge
    const tickMarks = useMemo(() => {
        const ticks = [];
        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * 180;
            const isMainTick = i % 2 === 0;
            const innerRadius = isMainTick ? 58 : 62;
            const outerRadius = 68;
            const rad = (angle * Math.PI) / 180;
            
            // Calculate positions (mirror because arc goes from left to right)
            const x1 = 100 + innerRadius * Math.cos(Math.PI - rad);
            const y1 = 100 - innerRadius * Math.sin(Math.PI - rad);
            const x2 = 100 + outerRadius * Math.cos(Math.PI - rad);
            const y2 = 100 - outerRadius * Math.sin(Math.PI - rad);
            
            ticks.push({ x1, y1, x2, y2, isMainTick, value: i * 10 });
        }
        return ticks;
    }, []);

    const sizeClasses = {
        sm: 'w-28',
        md: 'w-40',
        lg: 'w-56'
    };

    return (
        <div className={`relative flex flex-col items-center justify-center ${sizeClasses[size]} ${className}`}>
            <svg
                viewBox="0 0 200 120"
                className="w-full h-auto overflow-visible gauge-container"
            >
                <defs>
                    {/* Instagram-inspired gradient */}
                    <linearGradient id={`gaugeGradient-${invertColor ? 'inv' : 'norm'}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={invertColor ? "#22c55e" : "#ef4444"} />
                        <stop offset="35%" stopColor="#eab308" />
                        <stop offset="100%" stopColor={invertColor ? "#ef4444" : "#22c55e"} />
                    </linearGradient>

                    {/* Glow Filter - Enhanced */}
                    <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Needle Shadow */}
                    <filter id="needleShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/>
                    </filter>

                    {/* Center Glow */}
                    <radialGradient id="centerGlow">
                        <stop offset="0%" stopColor={getColor.color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={getColor.color} stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* Background glow circle */}
                <circle 
                    cx="100" 
                    cy="100" 
                    r="45" 
                    fill="url(#centerGlow)"
                    style={{ transition: 'fill 0.5s ease' }}
                />

                {/* Tick Marks */}
                {tickMarks.map((tick, idx) => (
                    <line
                        key={idx}
                        x1={tick.x1}
                        y1={tick.y1}
                        x2={tick.x2}
                        y2={tick.y2}
                        stroke="currentColor"
                        strokeWidth={tick.isMainTick ? 2 : 1}
                        strokeLinecap="round"
                        className="text-gray-300 dark:text-gray-600"
                        style={{ opacity: tick.isMainTick ? 0.8 : 0.4 }}
                    />
                ))}

                {/* Background Track */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="text-gray-200 dark:text-gray-700"
                />

                {/* Colored Arc with Gradient */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke={`url(#gaugeGradient-${invertColor ? 'inv' : 'norm'})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={circumference - arcLength}
                    filter="url(#gaugeGlow)"
                    style={{
                        opacity: animatedValue > 0 ? 1 : 0,
                        transition: 'stroke-dashoffset 0.1s ease-out'
                    }}
                />

                {/* Needle Group */}
                <g
                    style={{
                        transform: `rotate(${needleAngle}deg)`,
                        transformOrigin: "100px 100px",
                        transition: 'transform 0.1s ease-out'
                    }}
                    filter="url(#needleShadow)"
                >
                    {/* Needle Shape - More elegant design */}
                    <path
                        d="M 100 100 L 30 100 L 35 97 L 100 94 Z"
                        fill="currentColor"
                        className="text-gray-800 dark:text-white"
                    />
                    <path
                        d="M 100 100 L 30 100 L 35 103 L 100 106 Z"
                        fill="currentColor"
                        className="text-gray-700 dark:text-gray-200"
                    />
                    
                    {/* Needle Tip Highlight */}
                    <circle 
                        cx="32" 
                        cy="100" 
                        r="2" 
                        fill={getColor.color}
                        style={{ transition: 'fill 0.3s ease' }}
                    />
                </g>

                {/* Center Pivot - Enhanced */}
                <circle 
                    cx="100" 
                    cy="100" 
                    r="12" 
                    fill="currentColor" 
                    className="text-gray-800 dark:text-white"
                />
                <circle 
                    cx="100" 
                    cy="100" 
                    r="9" 
                    fill="var(--card-background)"
                />
                <circle 
                    cx="100" 
                    cy="100" 
                    r="5" 
                    fill={getColor.color}
                    style={{ 
                        transition: 'fill 0.3s ease',
                        filter: `drop-shadow(0 0 4px ${getColor.glow})`
                    }}
                />
                <circle 
                    cx="100" 
                    cy="100" 
                    r="2" 
                    fill="white"
                    opacity="0.8"
                />

                {/* Level Labels */}
                <text x="20" y="115" className="text-[9px] font-medium fill-gray-400 dark:fill-gray-500">0</text>
                <text x="95" y="25" className="text-[9px] font-medium fill-gray-400 dark:fill-gray-500">50</text>
                <text x="175" y="115" className="text-[9px] font-medium fill-gray-400 dark:fill-gray-500">100</text>
            </svg>

            {/* Value Display */}
            {showValue && (
                <div className="absolute bottom-0 flex flex-col items-center">
                    <span 
                        className="text-2xl font-bold tracking-tight"
                        style={{ 
                            color: getColor.color,
                            transition: 'color 0.3s ease',
                            textShadow: `0 0 20px ${getColor.glow}`
                        }}
                    >
                        {Math.round(animatedValue * max)}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        / {max}
                    </span>
                </div>
            )}
        </div>
    );
};

export default Gauge;
