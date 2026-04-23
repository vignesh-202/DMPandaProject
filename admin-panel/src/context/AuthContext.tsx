import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Models } from 'appwrite';
import httpClient from '../lib/httpClient';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    loading: boolean;
    isAdmin: boolean;
    checkUser: () => Promise<Models.User<Models.Preferences> | null>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const checkUserPromiseRef = useRef<Promise<Models.User<Models.Preferences> | null> | null>(null);

    const checkUser = useCallback(async () => {
        if (checkUserPromiseRef.current) {
            return checkUserPromiseRef.current;
        }

        const promise = (async () => {
            try {
                setLoading(true);
                const response = await httpClient.get('/api/me');
                const session = response.data;
                setUser(session);

                const hasAdminLabel = session.labels?.includes('admin') || false;
                setIsAdmin(hasAdminLabel);
                return session;
            } catch (error: any) {
                if (error?.response?.status === 401 || error?.response?.status === 403) {
                    setUser(null);
                    setIsAdmin(false);
                }
                return null;
            } finally {
                setLoading(false);
            }
        })();

        checkUserPromiseRef.current = promise.finally(() => {
            checkUserPromiseRef.current = null;
        });

        return checkUserPromiseRef.current;
    }, []);

    const logout = useCallback(async () => {
        try {
            await httpClient.get('/logout'); // Or POST if changed
        } catch (e) {
            console.error(e);
        }
        setUser(null);
        setIsAdmin(false);
        window.location.href = '/login';
    }, []);

    useEffect(() => {
        void checkUser();
    }, [checkUser]);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, checkUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
