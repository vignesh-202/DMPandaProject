import React, { useRef } from 'react';
import { View, Text, TouchableWithoutFeedback, StyleSheet, Animated } from 'react-native';
import { Menu, Bell } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface DrawerHeaderProps {
    title: string;
    onMenuPress: () => void;
}

export default function DrawerHeader({ title, onMenuPress }: DrawerHeaderProps) {
    const { theme } = useTheme();
    const menuScaleAnim = useRef(new Animated.Value(1)).current;
    const bellScaleAnim = useRef(new Animated.Value(1)).current;

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const borderColor = isDark ? '#374151' : '#e5e7eb';
    const buttonBg = isDark ? '#374151' : '#f3f4f6';

    const handleMenuPressIn = () => {
        Animated.spring(menuScaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    const handleMenuPressOut = () => {
        Animated.spring(menuScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    const handleBellPressIn = () => {
        Animated.spring(bellScaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    const handleBellPressOut = () => {
        Animated.spring(bellScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    return (
        <View style={[styles.header, { backgroundColor: bgColor, borderBottomColor: borderColor }]}>
            <TouchableWithoutFeedback
                onPress={onMenuPress}
                onPressIn={handleMenuPressIn}
                onPressOut={handleMenuPressOut}
            >
                <Animated.View
                    style={[
                        styles.iconButton,
                        { backgroundColor: buttonBg, transform: [{ scale: menuScaleAnim }] }
                    ]}
                >
                    <Menu color={textColor} size={22} />
                </Animated.View>
            </TouchableWithoutFeedback>

            <Animated.Text style={[styles.title, { color: textColor }]}>
                {title}
            </Animated.Text>

            <TouchableWithoutFeedback
                onPressIn={handleBellPressIn}
                onPressOut={handleBellPressOut}
            >
                <Animated.View
                    style={[
                        styles.iconButton,
                        { backgroundColor: buttonBg, transform: [{ scale: bellScaleAnim }] }
                    ]}
                >
                    <View style={styles.notificationBadge}>
                        <Text style={styles.notificationCount}>3</Text>
                    </View>
                    <Bell color={textColor} size={22} />
                </Animated.View>
            </TouchableWithoutFeedback>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    iconButton: {
        padding: 10,
        borderRadius: 14,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 12,
    },
    notificationBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    notificationCount: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
