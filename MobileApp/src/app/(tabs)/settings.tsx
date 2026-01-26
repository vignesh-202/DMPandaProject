import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Settings, User, Bell, Shield, LogOut, Moon, Sun } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSession } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
    const { theme, toggleTheme } = useTheme();
    const { signOut } = useSession();
    const router = useRouter();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#111827' : '#f3f4f6';
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';
    const borderColor = isDark ? '#374151' : '#e5e7eb';

    const handleLogout = async () => {
        await signOut();
        router.replace('/login');
    };

    const SettingItem = ({ icon: Icon, title, subtitle, rightElement }: any) => (
        <View style={[styles.settingItem, { borderBottomColor: borderColor }]}>
            <View style={styles.settingLeft}>
                <Icon color={textColor} size={22} />
                <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: textColor }]}>{title}</Text>
                    {subtitle && <Text style={[styles.settingSubtitle, { color: mutedColor }]}>{subtitle}</Text>}
                </View>
            </View>
            {rightElement}
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.sectionTitle, { color: mutedColor }]}>ACCOUNT</Text>

                <SettingItem
                    icon={User}
                    title="Profile"
                    subtitle="Manage your profile information"
                />

                <SettingItem
                    icon={Bell}
                    title="Notifications"
                    subtitle="Configure notification preferences"
                />

                <SettingItem
                    icon={Shield}
                    title="Privacy & Security"
                    subtitle="Manage your account security"
                />
            </View>

            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.sectionTitle, { color: mutedColor }]}>APPEARANCE</Text>

                <TouchableOpacity onPress={toggleTheme}>
                    <SettingItem
                        icon={isDark ? Moon : Sun}
                        title="Dark Mode"
                        subtitle={isDark ? "Currently enabled" : "Currently disabled"}
                        rightElement={
                            <Switch
                                value={isDark}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#d1d5db', true: '#4b5563' }}
                                thumbColor={isDark ? '#ffffff' : '#000000'}
                            />
                        }
                    />
                </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg }]}>
                <TouchableOpacity onPress={handleLogout}>
                    <View style={styles.logoutButton}>
                        <LogOut color="#ef4444" size={22} />
                        <Text style={styles.logoutText}>Sign Out</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <Text style={[styles.version, { color: mutedColor }]}>
                DMPanda Mobile v1.0.0
            </Text>

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
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        marginLeft: 14,
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '500',
    },
    settingSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    logoutText: {
        marginLeft: 14,
        fontSize: 15,
        fontWeight: '500',
        color: '#ef4444',
    },
    version: {
        textAlign: 'center',
        fontSize: 12,
        marginTop: 8,
        marginBottom: 32,
    },
});