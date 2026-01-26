import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { HelpCircle, MessageCircle, Mail } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function SupportScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';

    const handleEmail = () => {
        Linking.openURL('mailto:support@dmpanda.com');
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.iconContainer}>
                    <HelpCircle color={textColor} size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Support</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    Need help? We're here to assist you with any questions or issues.
                </Text>

                <TouchableOpacity
                    style={[styles.supportOption, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}
                    onPress={handleEmail}
                >
                    <Mail color={textColor} size={24} />
                    <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: textColor }]}>Email Support</Text>
                        <Text style={[styles.optionDesc, { color: mutedColor }]}>support@dmpanda.com</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.supportOption, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}
                >
                    <MessageCircle color={textColor} size={24} />
                    <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: textColor }]}>Live Chat</Text>
                        <Text style={[styles.optionDesc, { color: mutedColor }]}>Available 24/7</Text>
                    </View>
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
    supportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        marginBottom: 12,
    },
    optionText: {
        marginLeft: 16,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    optionDesc: {
        fontSize: 13,
    },
});
