import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function TroubleshootScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';

    const troubleshootSteps = [
        { title: 'Check Instagram Connection', desc: 'Ensure your Instagram account is properly connected' },
        { title: 'Verify Automation Settings', desc: 'Check if your automation triggers are configured correctly' },
        { title: 'Review Message Templates', desc: 'Make sure your DM templates are set up properly' },
        { title: 'Check Rate Limits', desc: 'You may have hit Instagram\'s rate limits' },
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.iconContainer}>
                    <AlertCircle color="#ef4444" size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Automation Not Working?</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    Follow these steps to troubleshoot common automation issues.
                </Text>

                {troubleshootSteps.map((step, index) => (
                    <View
                        key={index}
                        style={[styles.stepItem, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                    >
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={[styles.stepTitle, { color: textColor }]}>{step.title}</Text>
                            <Text style={[styles.stepDesc, { color: mutedColor }]}>{step.desc}</Text>
                        </View>
                    </View>
                ))}

                <TouchableOpacity style={styles.refreshButton}>
                    <RefreshCw color="#ffffff" size={20} />
                    <Text style={styles.refreshText}>Run Diagnostics</Text>
                </TouchableOpacity>
            </View>
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
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        marginBottom: 10,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
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
        lineHeight: 18,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000000',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 10,
        gap: 8,
        marginTop: 16,
    },
    refreshText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
