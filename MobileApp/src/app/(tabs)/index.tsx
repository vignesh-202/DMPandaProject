import React, { useState, useEffect, useRef, memo } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { TrendingUp, Instagram } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import Gauge from '../../components/Gauge';

// Memoized stat card for performance
const StatCard = memo(({
    title,
    children,
    style,
    cardBg,
    delay = 0
}: {
    title: string;
    children: React.ReactNode;
    style?: any;
    cardBg: string;
    delay?: number;
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.card,
                {
                    backgroundColor: cardBg,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
                style
            ]}
        >
            <Text style={[styles.cardTitle, { color: '#9ca3af' }]}>{title}</Text>
            {children}
        </Animated.View>
    );
});

// Memoized Instagram card
const InstagramCard = memo(({
    followers,
    isDark,
    cardBg,
    textColor,
    mutedColor,
    greenColor
}: any) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;


    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            delay: 100,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.card, styles.instagramCard, { backgroundColor: cardBg, opacity: fadeAnim }]}>
            <View style={styles.instagramHeader}>
                <Instagram color="#E1306C" size={20} />
                <Text style={[styles.cardTitle, { color: textColor, marginLeft: 8, marginBottom: 0 }]}>Instagram</Text>
            </View>
            <Text style={[styles.bigNumber, { color: textColor }]}>{followers}k</Text>
            <Text style={[styles.statLabel, { color: mutedColor }]}>Followers</Text>
            <View style={styles.trendRow}>
                <TrendingUp color={greenColor} size={14} />
                <Text style={[styles.trendText, { color: greenColor }]}>12% Last week</Text>
            </View>
        </Animated.View>
    );
});

export default function DashboardScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [isAnimationVisible, setIsAnimationVisible] = useState(false);

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';
    const greenColor = isDark ? '#4ade80' : '#16a34a';

    // Placeholder data
    const smartScore = 82;
    const followersNumber = 24;
    const reelsNumber = 2986;
    const dmRate = 85;
    const actionsPerMonth = 100;
    const reelCommentReplies = 500;
    const postCommentReplies = 700;

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsAnimationVisible(true);
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: bgColor }]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
        >
            {/* Row 1: Smart Score & DM Rate Gauges */}
            <View style={styles.gaugeRow}>
                <StatCard title="Smart Score" style={styles.gaugeCard} cardBg={cardBg} delay={0}>
                    <Gauge
                        value={smartScore}
                        max={100}
                        startAnimation={isAnimationVisible}
                        isDark={isDark}
                        size={100}
                    />
                    <View style={styles.trendRow}>
                        <TrendingUp color={greenColor} size={14} />
                        <Text style={[styles.trendText, { color: greenColor }]}>18 Last week</Text>
                    </View>
                </StatCard>

                <StatCard title="DM Rate" style={styles.gaugeCard} cardBg={cardBg} delay={50}>
                    <Gauge
                        value={dmRate}
                        max={100}
                        startAnimation={isAnimationVisible}
                        invertColor={true}
                        isDark={isDark}
                        size={100}
                    />
                    <Text style={[styles.dmRateText, { color: textColor }]}>{dmRate} DMs/hr</Text>
                </StatCard>
            </View>

            {/* Row 2: Instagram Stats & Reels */}
            <View style={styles.statsRow}>
                <InstagramCard
                    followers={followersNumber}
                    isDark={isDark}
                    cardBg={cardBg}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    greenColor={greenColor}
                />

                <StatCard title="Reels" style={styles.reelsCard} cardBg={cardBg} delay={150}>
                    <Text style={[styles.bigNumber, { color: textColor }]}>{reelsNumber}</Text>
                    <View style={styles.trendRow}>
                        <TrendingUp color={greenColor} size={14} />
                        <Text style={[styles.trendText, { color: greenColor }]}>12% Last week</Text>
                    </View>
                </StatCard>
            </View>

            {/* Row 3: Small Metric Gauges */}
            <View style={styles.metricsRow}>
                <StatCard title="Actions/Mo" style={styles.metricCard} cardBg={cardBg} delay={200}>
                    <Gauge
                        value={actionsPerMonth}
                        max={2000}
                        startAnimation={isAnimationVisible}
                        invertColor={true}
                        isDark={isDark}
                        size={70}
                    />
                </StatCard>

                <StatCard title="Reel Replies" style={styles.metricCard} cardBg={cardBg} delay={250}>
                    <Gauge
                        value={reelCommentReplies}
                        max={1000}
                        startAnimation={isAnimationVisible}
                        invertColor={true}
                        isDark={isDark}
                        size={70}
                    />
                </StatCard>

                <StatCard title="Post Replies" style={styles.metricCard} cardBg={cardBg} delay={300}>
                    <Gauge
                        value={postCommentReplies}
                        max={1000}
                        startAnimation={isAnimationVisible}
                        invertColor={true}
                        isDark={isDark}
                        size={70}
                    />
                </StatCard>
            </View>

            {/* Analytics Placeholder */}
            <StatCard title="Analytics Overview" cardBg={cardBg} delay={350}>
                <View style={[styles.chartPlaceholder, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                    <Text style={[styles.placeholderText, { color: mutedColor }]}>Charts Coming Soon</Text>
                </View>
            </StatCard>

            {/* Bottom spacer */}
            <View style={{ height: 90 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12,
    },
    card: {
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        textAlign: 'center',
    },
    gaugeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    gaugeCard: {
        flex: 1,
        alignItems: 'center',
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    trendText: {
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '500',
    },
    dmRateText: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    instagramCard: {
        flex: 1,
        alignItems: 'center',
    },
    instagramHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    reelsCard: {
        flex: 1,
        alignItems: 'center',
    },
    bigNumber: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    metricCard: {
        flex: 1,
        alignItems: 'center',
        padding: 10,
    },
    chartPlaceholder: {
        height: 140,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 13,
    },
});