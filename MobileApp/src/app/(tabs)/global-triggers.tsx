import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Globe } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function GlobalTriggersScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.iconContainer}>
                    <Globe color={textColor} size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Global Triggers</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    Set up triggers that apply across all your Instagram content automatically.
                </Text>
                <View style={[styles.comingSoon, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                    <Text style={[styles.comingSoonText, { color: textColor }]}>
                        Configure global automation triggers
                    </Text>
                </View>
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
        fontSize: 24,
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
    comingSoon: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    comingSoonText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
