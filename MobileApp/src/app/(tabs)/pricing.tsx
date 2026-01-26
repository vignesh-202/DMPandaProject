import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Tag, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function PricingScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';

    const plans = [
        {
            name: 'Free',
            price: '₹0',
            period: '/month',
            features: ['Basic DM automation', '100 DMs/day', 'Email support'],
            popular: false,
        },
        {
            name: 'Pro',
            price: '₹999',
            period: '/month',
            features: ['Unlimited DM automation', 'All automation types', 'Priority support', 'Analytics dashboard'],
            popular: true,
        },
        {
            name: 'Enterprise',
            price: '₹2999',
            period: '/month',
            features: ['Everything in Pro', 'Multiple accounts', 'API access', 'Dedicated support'],
            popular: false,
        },
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <Tag color={textColor} size={40} />
                <Text style={[styles.title, { color: textColor }]}>Choose Your Plan</Text>
                <Text style={[styles.subtitle, { color: mutedColor }]}>
                    Select the plan that best fits your needs
                </Text>
            </View>

            {plans.map((plan, index) => (
                <View
                    key={index}
                    style={[
                        styles.planCard,
                        { backgroundColor: cardBg },
                        plan.popular && styles.popularCard
                    ]}
                >
                    {plan.popular && (
                        <View style={styles.popularBadge}>
                            <Text style={styles.popularText}>Most Popular</Text>
                        </View>
                    )}
                    <Text style={[styles.planName, { color: textColor }]}>{plan.name}</Text>
                    <View style={styles.priceRow}>
                        <Text style={[styles.price, { color: textColor }]}>{plan.price}</Text>
                        <Text style={[styles.period, { color: mutedColor }]}>{plan.period}</Text>
                    </View>

                    <View style={styles.features}>
                        {plan.features.map((feature, fIndex) => (
                            <View key={fIndex} style={styles.featureRow}>
                                <Check color={isDark ? '#4ade80' : '#16a34a'} size={18} />
                                <Text style={[styles.featureText, { color: textColor }]}>{feature}</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.selectButton,
                            { backgroundColor: plan.popular ? '#000000' : (isDark ? '#374151' : '#e5e7eb') }
                        ]}
                    >
                        <Text style={[
                            styles.buttonText,
                            { color: plan.popular ? '#ffffff' : textColor }
                        ]}>
                            {plan.name === 'Free' ? 'Current Plan' : 'Upgrade Now'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ))}

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
    header: {
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 8,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
    },
    planCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    popularCard: {
        borderWidth: 2,
        borderColor: '#000000',
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        backgroundColor: '#000000',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    popularText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    planName: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    price: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    period: {
        fontSize: 14,
        marginLeft: 4,
    },
    features: {
        marginBottom: 20,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    featureText: {
        fontSize: 14,
        marginLeft: 10,
    },
    selectButton: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});