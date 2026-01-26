import React from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { MessageCircle, Send } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function FeedbackScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';
    const inputBg = isDark ? '#374151' : '#f3f4f6';

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.iconContainer}>
                    <MessageCircle color={textColor} size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Have Feedback?</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    We value your feedback! Let us know how we can improve DMPanda.
                </Text>

                <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor: isDark ? '#4b5563' : '#d1d5db' }]}
                    placeholder="Your feedback..."
                    placeholderTextColor={mutedColor}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                />

                <TouchableOpacity style={styles.submitButton}>
                    <Send color="#ffffff" size={20} />
                    <Text style={styles.submitText}>Submit Feedback</Text>
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
    input: {
        width: '100%',
        minHeight: 120,
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        borderWidth: 1,
        marginBottom: 16,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000000',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 10,
        gap: 8,
    },
    submitText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
