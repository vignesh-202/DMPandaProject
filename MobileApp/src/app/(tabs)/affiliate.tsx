import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Users, Copy, TrendingUp, Wallet } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function AffiliateScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';

    const stats = [
        { icon: Users, label: 'Referrals', value: '0' },
        { icon: TrendingUp, label: 'Conversions', value: '0' },
        { icon: Wallet, label: 'Earnings', value: '₹0' },
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.iconContainer}>
                    <Users color={textColor} size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Affiliate & Referral</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    Earn money by referring friends to DMPanda. Get 20% commission on every successful referral!
                </Text>

                <View style={[styles.referralBox, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                    <Text style={[styles.referralLabel, { color: mutedColor }]}>Your Referral Link</Text>
                    <View style={styles.referralRow}>
                        <Text style={[styles.referralLink, { color: textColor }]} numberOfLines={1}>
                            dmpanda.com/ref/yourcode
                        </Text>
                        <TouchableOpacity style={styles.copyButton}>
                            <Copy color={textColor} size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.statsRow}>
                {stats.map((stat, index) => (
                    <View key={index} style={[styles.statCard, { backgroundColor: cardBg }]}>
                        <stat.icon color={textColor} size={24} />
                        <Text style={[styles.statValue, { color: textColor }]}>{stat.value}</Text>
                        <Text style={[styles.statLabel, { color: mutedColor }]}>{stat.label}</Text>
                    </View>
                ))}
            </View>

            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>How It Works</Text>

                <View style={styles.step}>
                    <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: textColor }]}>Share Your Link</Text>
                        <Text style={[styles.stepDesc, { color: mutedColor }]}>Share your unique referral link with friends</Text>
                    </View>
                </View>

                <View style={styles.step}>
                    <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: textColor }]}>They Sign Up</Text>
                        <Text style={[styles.stepDesc, { color: mutedColor }]}>Your friend signs up using your link</Text>
                    </View>
                </View>

                <View style={styles.step}>
                    <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: textColor }]}>You Earn</Text>
                        <Text style={[styles.stepDesc, { color: mutedColor }]}>Get 20% commission on their subscription</Text>
                    </View>
                </View>
            </View>

            {/* Spacer for bottom nav */}
            <View style={{ height: 80 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    referralBox: {
        padding: 16,
        borderRadius: 12,
    },
    referralLabel: {
        fontSize: 12,
        marginBottom: 8,
    },
    referralRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    referralLink: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    copyButton: {
        padding: 8,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    step: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    stepNumberText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    stepDesc: {
        fontSize: 13,
    },
});