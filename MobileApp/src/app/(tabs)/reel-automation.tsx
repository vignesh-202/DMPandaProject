import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Film } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ReelAutomationScreen() {
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
                    <Film color={textColor} size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Reel Automation</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    Automate responses to comments and DMs related to your Instagram Reels.
                </Text>
                <View style={[styles.comingSoon, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                    <Text style={[styles.comingSoonText, { color: textColor }]}>
                        Configure Reel automation settings
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
