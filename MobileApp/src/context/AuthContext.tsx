import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';

interface AuthContextType {
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
    session: string | null;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    signIn: async () => { },
    signOut: async () => { },
    session: null,
    isLoading: true,
});

export function useSession() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log("Checking for session token...");
        SecureStore.getItemAsync('session_token')
            .then((token) => {
                console.log("Session token retrieved:", token ? "Found" : "Not found");
                setSession(token);
            })
            .catch(err => {
                console.error("Error retrieving session token:", err);
            })
            .finally(() => {
                console.log("Finished checking session, setting isLoading to false.");
                setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        if (session) {
            api.defaults.headers.common['Authorization'] = `Bearer ${session}`;
        } else {
            delete api.defaults.headers.common['Authorization'];
        }
    }, [session]);

    const signIn = async (token: string) => {
        await SecureStore.setItemAsync('session_token', token);
        setSession(token);
    };

    const signOut = async () => {
        await SecureStore.deleteItemAsync('session_token');
        setSession(null);
    };

    return (
        <AuthContext.Provider
            value={{
                signIn,
                signOut,
                session,
                isLoading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
