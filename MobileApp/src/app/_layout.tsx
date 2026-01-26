import '../styles/global.css';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useSession } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function InitialLayout() {
    const { session, isLoading } = useSession();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        console.log(`[RootLayout] isLoading: ${isLoading}, session: ${session ? 'exists' : 'null'}, segments: ${JSON.stringify(segments)}`);
        
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!session && !inAuthGroup) {
            console.log("[RootLayout] Redirecting to /login");
            router.replace('/login');
        } else if (session && inAuthGroup) {
            console.log("[RootLayout] Redirecting to /(tabs)");
            router.replace('/(tabs)');
        }
    }, [session, isLoading, segments]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f2937' }}>
                <ActivityIndicator size="large" color="#f3f4f6" />
            </View>
        );
    }

    return <Slot />;
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <ThemeProvider>
                    <InitialLayout />
                </ThemeProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
