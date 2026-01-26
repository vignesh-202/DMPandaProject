import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableWithoutFeedback,
    Modal,
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Switch,
} from 'react-native';
import {
    Home,
    Settings,
    User,
    LogOut,
    X,
    Instagram,
    Sun,
    Moon,
    MessageSquare,
    Globe,
    Film,
    FileText,
    BookOpen,
    Radio,
    AtSign,
    CreditCard,
    Landmark,
    Tag,
    Users,
    PlayCircle,
    HelpCircle,
    Mail,
    MessageCircle,
    AlertCircle,
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSession } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import InstagramProfileIcon from './InstagramProfileIcon';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

interface DrawerProps {
    visible: boolean;
    onClose: () => void;
}

interface MenuItem {
    icon: any;
    label: string;
    route: string;
}

// Animated menu item component
const AnimatedMenuItem: React.FC<{
    item: MenuItem;
    index: number;
    isActive: boolean;
    onPress: () => void;
    isDark: boolean;
    textColor: string;
    selectedBg: string;
    selectedTextColor: string;
}> = ({ item, index, isActive, onPress, isDark, textColor, selectedBg, selectedTextColor }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            delay: index * 30,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
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

    const Icon = item.icon;

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View
                style={[
                    styles.menuItem,
                    isActive && { backgroundColor: selectedBg, borderRadius: 12 },
                    {
                        opacity: opacityAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <View style={styles.menuItemLeft}>
                    <Icon
                        color={isActive ? selectedTextColor : textColor}
                        size={20}
                    />
                    <Text style={[
                        styles.menuLabel,
                        { color: isActive ? selectedTextColor : textColor }
                    ]}>
                        {item.label}
                    </Text>
                </View>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

export default function CustomDrawer({ visible, onClose }: DrawerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { signOut } = useSession();
    const { theme, toggleTheme } = useTheme();

    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;

    const isDark = theme === 'dark';

    const bgColor = isDark ? '#1f2937' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';
    const borderColor = isDark ? '#374151' : '#e5e7eb';
    const cardBg = isDark ? '#374151' : '#f9fafb';
    const selectedBg = isDark ? '#ffffff' : '#000000';
    const selectedTextColor = isDark ? '#000000' : '#ffffff';

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 65,
                    friction: 11,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(contentOpacity, {
                    toValue: 1,
                    duration: 300,
                    delay: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    useNativeDriver: true,
                    tension: 65,
                    friction: 11,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(contentOpacity, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const menuItems: MenuItem[] = [
        { icon: Home, label: 'Dashboard', route: '/(tabs)' },
        { icon: MessageSquare, label: 'DM Automation', route: '/(tabs)/dm-automation' },
        { icon: Globe, label: 'Global Triggers', route: '/(tabs)/global-triggers' },
        { icon: Film, label: 'Reel Automation', route: '/(tabs)/reel-automation' },
        { icon: FileText, label: 'Post Automation', route: '/(tabs)/post-automation' },
        { icon: BookOpen, label: 'Story Automation', route: '/(tabs)/story-automation' },
        { icon: Radio, label: 'Live Automation', route: '/(tabs)/live-automation' },
        { icon: AtSign, label: 'Mentions', route: '/(tabs)/mentions' },
        { icon: CreditCard, label: 'My Plan', route: '/(tabs)/my-plan' },
        { icon: Landmark, label: 'Transactions', route: '/(tabs)/transactions' },
        { icon: Tag, label: 'Pricing', route: '/(tabs)/pricing' },
        { icon: Users, label: 'Affiliate & Referral', route: '/(tabs)/affiliate' },
        { icon: PlayCircle, label: 'Watch Video', route: '/(tabs)/watch-video' },
        { icon: HelpCircle, label: 'Support', route: '/(tabs)/support' },
        { icon: Mail, label: 'Contact', route: '/(tabs)/contact' },
        { icon: Settings, label: 'Account Settings', route: '/(tabs)/settings' },
        { icon: MessageCircle, label: 'Have feedback?', route: '/(tabs)/feedback' },
        { icon: AlertCircle, label: 'Automation Not working?', route: '/(tabs)/troubleshoot' },
    ];

    const isActiveRoute = (route: string): boolean => {
        if (route === '/(tabs)') {
            return pathname === '/' || pathname === '/(tabs)' || pathname === '/index';
        }
        return pathname.includes(route.replace('/(tabs)', ''));
    };

    const handleNavigation = (route: string) => {
        onClose();
        setTimeout(() => {
            router.push(route as any);
        }, 200);
    };

    const handleLogout = async () => {
        onClose();
        await signOut();
        router.replace('/login');
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View
                    style={[styles.backdrop, { opacity: backdropOpacity }]}
                >
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={styles.backdropTouchable} />
                    </TouchableWithoutFeedback>
                </Animated.View>

                {/* Drawer */}
                <Animated.View
                    style={[
                        styles.drawer,
                        {
                            backgroundColor: bgColor,
                            transform: [{ translateX: slideAnim }],
                        },
                    ]}
                >
                    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
                        <ScrollView
                            style={styles.scrollView}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            {/* Header */}
                            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                                <TouchableWithoutFeedback onPress={onClose}>
                                    <View style={styles.closeButton}>
                                        <X color={textColor} size={24} />
                                    </View>
                                </TouchableWithoutFeedback>

                                {/* Profile Section */}
                                <View style={[styles.profileSection, { backgroundColor: cardBg }]}>
                                    <InstagramProfileIcon size={65} isDark={isDark} />
                                    <Text style={[styles.profileName, { color: textColor }]}>
                                        DMPanda User
                                    </Text>
                                    <View style={styles.instagramBadge}>
                                        <Instagram color="#E1306C" size={14} />
                                        <Text style={styles.instagramHandle}>@dmpanda</Text>
                                    </View>

                                    {/* Stats */}
                                    <View style={styles.statsContainer}>
                                        <View style={styles.statItem}>
                                            <Text style={[styles.statValue, { color: textColor }]}>24.5K</Text>
                                            <Text style={[styles.statLabel, { color: mutedColor }]}>Followers</Text>
                                        </View>
                                        <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
                                        <View style={styles.statItem}>
                                            <Text style={[styles.statValue, { color: textColor }]}>2,986</Text>
                                            <Text style={[styles.statLabel, { color: mutedColor }]}>Reels</Text>
                                        </View>
                                        <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
                                        <View style={styles.statItem}>
                                            <Text style={[styles.statValue, { color: textColor }]}>85/hr</Text>
                                            <Text style={[styles.statLabel, { color: mutedColor }]}>DM Rate</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Theme Toggle */}
                            <TouchableWithoutFeedback onPress={toggleTheme}>
                                <View style={[styles.themeToggleContainer, { backgroundColor: cardBg, borderColor }]}>
                                    <View style={styles.themeToggleLeft}>
                                        {isDark ? (
                                            <Moon color={textColor} size={20} />
                                        ) : (
                                            <Sun color={textColor} size={20} />
                                        )}
                                        <Text style={[styles.themeLabel, { color: textColor }]}>
                                            Dark Mode
                                        </Text>
                                    </View>
                                    <Switch
                                        value={isDark}
                                        onValueChange={toggleTheme}
                                        trackColor={{ false: '#d1d5db', true: '#4b5563' }}
                                        thumbColor={isDark ? '#ffffff' : '#000000'}
                                        ios_backgroundColor="#d1d5db"
                                    />
                                </View>
                            </TouchableWithoutFeedback>

                            {/* Menu Items */}
                            <View style={styles.menuContainer}>
                                <Text style={[styles.sectionTitle, { color: mutedColor }]}>
                                    FEATURES
                                </Text>
                                {menuItems.map((item, index) => (
                                    <AnimatedMenuItem
                                        key={index}
                                        item={item}
                                        index={index}
                                        isActive={isActiveRoute(item.route)}
                                        onPress={() => handleNavigation(item.route)}
                                        isDark={isDark}
                                        textColor={textColor}
                                        selectedBg={selectedBg}
                                        selectedTextColor={selectedTextColor}
                                    />
                                ))}
                            </View>

                            {/* Logout */}
                            <TouchableWithoutFeedback onPress={handleLogout}>
                                <View style={styles.logoutButton}>
                                    <LogOut color="#ef4444" size={20} />
                                    <Text style={styles.logoutLabel}>Logout</Text>
                                </View>
                            </TouchableWithoutFeedback>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <Text style={[styles.versionText, { color: mutedColor }]}>
                                    DMPanda Mobile v1.0.0
                                </Text>
                            </View>
                        </ScrollView>
                    </Animated.View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdropTouchable: {
        flex: 1,
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    header: {
        paddingTop: 50,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 16,
        zIndex: 10,
        padding: 8,
    },
    profileSection: {
        padding: 16,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 16,
        alignItems: 'center',
    },
    profileName: {
        fontSize: 17,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 4,
    },
    instagramBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    instagramHandle: {
        fontSize: 13,
        color: '#E1306C',
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingTop: 10,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
    },
    statDivider: {
        width: 1,
        height: 28,
    },
    themeToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    themeToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    themeLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    menuContainer: {
        paddingTop: 16,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 20,
        paddingBottom: 8,
        letterSpacing: 1.2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        paddingHorizontal: 16,
        marginHorizontal: 12,
        marginVertical: 1,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    menuLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 28,
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    logoutLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#ef4444',
    },
    footer: {
        padding: 16,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 11,
    },
});
