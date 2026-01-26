import React, { useEffect, useRef } from 'react';
import { View, TouchableWithoutFeedback, Text, StyleSheet, Platform, Animated } from 'react-native';
import { Home, CreditCard, Settings, Mail } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

interface NavItemProps {
    icon: any;
    label: string;
    route: string;
    isActive: boolean;
    onPress: () => void;
    isDark: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, isActive, onPress, isDark }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const bgAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

    const activeColor = isDark ? '#ffffff' : '#000000';
    const inactiveColor = isDark ? '#6b7280' : '#9ca3af';

    useEffect(() => {
        Animated.spring(bgAnim, {
            toValue: isActive ? 1 : 0,
            useNativeDriver: false,
            tension: 100,
            friction: 10,
        }).start();
    }, [isActive]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    const backgroundColor = bgAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', isDark ? '#ffffff' : '#000000'],
    });

    const iconColor = isActive ? (isDark ? '#000000' : '#ffffff') : inactiveColor;

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View style={[styles.navItem, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.View style={[
                    styles.iconContainer,
                    { backgroundColor },
                ]}>
                    <Icon color={iconColor} size={22} />
                </Animated.View>
                <Text style={[
                    styles.label,
                    { color: isActive ? activeColor : inactiveColor }
                ]}>
                    {label}
                </Text>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const BottomNav: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { theme } = useTheme();

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#1f2937' : '#ffffff';
    const borderColor = isDark ? '#374151' : '#e5e7eb';

    // Reordered: Home, My Plan, Contact, Settings (Settings last)
    const navItems = [
        { icon: Home, label: 'Home', route: '/(tabs)' },
        { icon: CreditCard, label: 'My Plan', route: '/(tabs)/my-plan' },
        { icon: Mail, label: 'Contact', route: '/(tabs)/contact' },
        { icon: Settings, label: 'Settings', route: '/(tabs)/settings' },
    ];

    const isActive = (route: string) => {
        if (route === '/(tabs)') {
            return pathname === '/' || pathname === '/(tabs)' || pathname === '/index';
        }
        return pathname.includes(route.replace('/(tabs)', ''));
    };

    const handlePress = (route: string) => {
        router.push(route as any);
    };

    return (
        <View style={[styles.container, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
            {navItems.map((item, index) => (
                <NavItem
                    key={index}
                    icon={item.icon}
                    label={item.label}
                    route={item.route}
                    isActive={isActive(item.route)}
                    onPress={() => handlePress(item.route)}
                    isDark={isDark}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 6,
        paddingBottom: Platform.OS === 'ios' ? 24 : 10,
        borderTopWidth: 1,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingVertical: 4,
    },
    iconContainer: {
        padding: 10,
        borderRadius: 20, // Curved/pill shape instead of square
        marginBottom: 3,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
    },
});

export default BottomNav;
