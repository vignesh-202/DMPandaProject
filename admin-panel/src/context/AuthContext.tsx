import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Models } from 'appwrite';
import httpClient from '../lib/httpClient';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    loading: boolean;
    isAdmin: boolean;
    checkUser: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const checkUser = async () => {
        try {
            setLoading(true);
            const response = await httpClient.get('/me');
            const session = response.data;
            setUser(session);

            // Check if user has 'admin' label or role
            // Flask /api/me returns user object similar to Appwrite
            const hasAdminLabel = session.labels?.includes('admin') || false;
            setIsAdmin(hasAdminLabel);

        } catch (error) {
            setUser(null);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await httpClient.get('/logout'); // Or POST if changed
        } catch (e) {
            console.error(e);
        }
        setUser(null);
        setIsAdmin(false);
        window.location.href = '/login';
    };

    useEffect(() => {
        checkUser();
    }, []);

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
