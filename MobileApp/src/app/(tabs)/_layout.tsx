import { Tabs } from 'expo-router';
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import CustomDrawer from '../../components/CustomDrawer';
import DrawerHeader from '../../components/DrawerHeader';
import BottomNav from '../../components/BottomNav';

export default function AppLayout() {
    const { theme } = useTheme();
    const [drawerVisible, setDrawerVisible] = useState(false);

    const openDrawer = () => setDrawerVisible(true);
    const closeDrawer = () => setDrawerVisible(false);

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#111827' : '#f3f4f6';

    return (
        <View style={[styles.container, { backgroundColor: bgColor }]}>
            <Tabs
                screenOptions={{
                    headerShown: true,
                    tabBarStyle: { display: 'none' }, // Hide default tab bar
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Dashboard',
                        header: () => <DrawerHeader title="Dashboard" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="dm-automation"
                    options={{
                        title: 'DM Automation',
                        header: () => <DrawerHeader title="DM Automation" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="global-triggers"
                    options={{
                        title: 'Global Triggers',
                        header: () => <DrawerHeader title="Global Triggers" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="reel-automation"
                    options={{
                        title: 'Reel Automation',
                        header: () => <DrawerHeader title="Reel Automation" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="post-automation"
                    options={{
                        title: 'Post Automation',
                        header: () => <DrawerHeader title="Post Automation" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="story-automation"
                    options={{
                        title: 'Story Automation',
                        header: () => <DrawerHeader title="Story Automation" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="live-automation"
                    options={{
                        title: 'Live Automation',
                        header: () => <DrawerHeader title="Live Automation" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="mentions"
                    options={{
                        title: 'Mentions',
                        header: () => <DrawerHeader title="Mentions" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="my-plan"
                    options={{
                        title: 'My Plan',
                        header: () => <DrawerHeader title="My Plan" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="transactions"
                    options={{
                        title: 'Transactions',
                        header: () => <DrawerHeader title="Transactions" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="pricing"
                    options={{
                        title: 'Pricing',
                        header: () => <DrawerHeader title="Pricing" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="affiliate"
                    options={{
                        title: 'Affiliate & Referral',
                        header: () => <DrawerHeader title="Affiliate & Referral" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="watch-video"
                    options={{
                        title: 'Watch Video',
                        header: () => <DrawerHeader title="Watch Video" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="support"
                    options={{
                        title: 'Support',
                        header: () => <DrawerHeader title="Support" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="contact"
                    options={{
                        title: 'Contact',
                        header: () => <DrawerHeader title="Contact" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        title: 'Account Settings',
                        header: () => <DrawerHeader title="Account Settings" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="feedback"
                    options={{
                        title: 'Feedback',
                        header: () => <DrawerHeader title="Have Feedback?" onMenuPress={openDrawer} />,
                    }}
                />
                <Tabs.Screen
                    name="troubleshoot"
                    options={{
                        title: 'Troubleshoot',
                        header: () => <DrawerHeader title="Troubleshoot" onMenuPress={openDrawer} />,
                    }}
                />
            </Tabs>

            {/* Bottom Navigation Bar */}
            <BottomNav />

            {/* Drawer Menu */}
            <CustomDrawer visible={drawerVisible} onClose={closeDrawer} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});