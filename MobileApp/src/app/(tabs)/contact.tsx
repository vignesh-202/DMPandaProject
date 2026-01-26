import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Mail, Phone, MapPin } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ContactScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';

    const handleEmail = () => {
        Linking.openURL('mailto:contact@dmpanda.com');
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.iconContainer}>
                    <Mail color={textColor} size={48} />
                </View>
                <Text style={[styles.title, { color: textColor }]}>Contact Us</Text>
                <Text style={[styles.description, { color: mutedColor }]}>
                    Get in touch with our team. We'd love to hear from you!
                </Text>

                <TouchableOpacity
                    style={[styles.contactOption, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}
                    onPress={handleEmail}
                >
                    <Mail color={textColor} size={24} />
                    <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: textColor }]}>Email</Text>
                        <Text style={[styles.optionDesc, { color: mutedColor }]}>contact@dmpanda.com</Text>
                    </View>
                </TouchableOpacity>

                <View style={[styles.contactOption, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                    <MapPin color={textColor} size={24} />
                    <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: textColor }]}>Location</Text>
                        <Text style={[styles.optionDesc, { color: mutedColor }]}>Available Worldwide</Text>
                    </View>
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
    contactOption: {
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
