import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface GaugeProps {
    value: number;
    max?: number;
    label?: string;
    subLabel?: string;
    startAnimation?: boolean;
    invertColor?: boolean;
    size?: number;
    isDark?: boolean;
}

const Gauge: React.FC<GaugeProps> = ({
    value,
    max = 100,
    startAnimation = true,
    invertColor = false,
    size = 120,
    isDark = false,
}) => {
    const [animatedValue, setAnimatedValue] = useState(0);
    const [glowIntensity, setGlowIntensity] = useState(0);
    const animationRef = useRef<number | null>(null);

    const percent = Math.max(0, Math.min(value, max)) / max;

    useEffect(() => {
        if (startAnimation) {
            let startTime: number | null = null;
            const duration = 1800;
            const targetPercent = percent;

            const animate = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);

                let currentVal;
                if (progress < 0.5) {
                    const p = progress * 2;
                    const e = 1 - Math.pow(1 - p, 4);
                    currentVal = e;
                } else {
                    const p = (progress - 0.5) * 2;
                    const e = 1 - Math.pow(1 - p, 4);
                    currentVal = 1 - (1 - targetPercent) * e;
                }

                setAnimatedValue(currentVal);
                setGlowIntensity(0.6 + 0.4 * Math.sin(timestamp / 200));

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    const pulseGlow = (ts: number) => {
                        setGlowIntensity(0.7 + 0.3 * Math.sin(ts / 300));
                        animationRef.current = requestAnimationFrame(pulseGlow);
                    };
                    animationRef.current = requestAnimationFrame(pulseGlow);
                }
            };

            animationRef.current = requestAnimationFrame(animate);

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
            };
        } else {
            setAnimatedValue(percent);
            setGlowIntensity(0.8);
        }
    }, [startAnimation, percent]);

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
        const p = animatedValue;
        if (invertColor) {
            if (p <= 0.5) {
                return interpolateColor('#86efac', '#fde047', p * 2);
            } else {
                return interpolateColor('#fde047', '#f87171', (p - 0.5) * 2);
            }
        } else {
            if (p <= 0.5) {
                return interpolateColor('#f87171', '#fde047', p * 2);
            } else {
                return interpolateColor('#fde047', '#86efac', (p - 0.5) * 2);
            }
        }
    };

    const color = getColor();
    const bgColor = isDark ? '#374151' : '#e5e7eb';
    const textColor = isDark ? '#ffffff' : '#000000';

    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const centerX = size / 2;
    const centerY = size / 2;

    const startAngle = 135;
    const sweepAngle = 270;

    const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
            x: cx + r * Math.cos(angleRad),
            y: cy + r * Math.sin(angleRad),
        };
    };

    const describeArc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
        const start = polarToCartesian(cx, cy, r, endDeg);
        const end = polarToCartesian(cx, cy, r, startDeg);
        const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
    };

    const endAngle = 405;
    const currentAngle = startAngle + sweepAngle * animatedValue;
    const needleEnd = polarToCartesian(centerX, centerY, radius - 18, currentAngle);

    const bgArcPath = describeArc(centerX, centerY, radius, startAngle, endAngle);
    const filledArcPath = describeArc(centerX, centerY, radius, startAngle, currentAngle);

    const displayValue = Math.round(animatedValue * max);

    return (
        <View style={styles.container}>
            <View style={[
                styles.gaugeContainer,
                {
                    width: size,
                    height: size * 0.7,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: glowIntensity,
                    shadowRadius: 15,
                }
            ]}>
                <Svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
                    <Path
                        d={bgArcPath}
                        fill="none"
                        stroke={bgColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    <Path
                        d={filledArcPath}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth + 6}
                        strokeLinecap="round"
                        opacity={0.3}
                    />
                    <Path
                        d={filledArcPath}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    <Line
                        x1={centerX}
                        y1={centerY}
                        x2={needleEnd.x}
                        y2={needleEnd.y}
                        stroke={textColor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                    />
                    <Circle cx={centerX} cy={centerY} r={5} fill={textColor} />
                </Svg>
            </View>
            <Text style={[
                styles.valueText,
                { color, textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }
            ]}>
                {displayValue}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    gaugeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueText: {
        fontSize: 26,
        fontWeight: 'bold',
        marginTop: -8,
    },
});

export default Gauge;
