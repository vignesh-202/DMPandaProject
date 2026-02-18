/**
 * Insforge Authentication Context
 * 
 * This is a proof-of-concept replacement for AuthContext.tsx
 * It uses the Insforge SDK for authentication instead of Appwrite.
 * 
 * Migration Note: 
 * - Replace AuthContext.tsx with this file after testing
 * - Update all imports from './AuthContext' to './InsforgeAuthContext'
 */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { insforge, database, TABLES } from '../lib/insforge';

// Types
interface User {
    id: string;
    email: string;
    emailVerified: boolean;
    profile?: {
        name?: string;
        avatar_url?: string;
    };
    metadata?: Record<string, unknown>;
}

interface AppProfile {
    id: string;
    user_id: string;
    credits: number;
    tier: string;
    referral_code?: string;
}

interface AuthContextProps {
    isAuthenticated: boolean | null;
    isLoading: boolean;
    isVerified: boolean;
    user: User | null;
    appProfile: AppProfile | null;
    hasPassword?: boolean;
    hasLinkedInstagram?: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<{ success: boolean; requiresVerification?: boolean; error?: string }>;
    logout: () => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
    resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    checkAuth: () => Promise<boolean>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
    isAuthenticated: null,
    isLoading: true,
    isVerified: false,
    user: null,
    appProfile: null,
    login: async () => ({ success: false }),
    loginWithGoogle: async () => { },
    register: async () => ({ success: false }),
    logout: async () => { },
    verifyEmail: async () => ({ success: false }),
    resendVerificationEmail: async () => ({ success: false }),
    resetPassword: async () => ({ success: false }),
    checkAuth: async () => false,
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const InsforgeAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [appProfile, setAppProfile] = useState<AppProfile | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [hasLinkedInstagram, setHasLinkedInstagram] = useState<boolean | undefined>(undefined);

    // Fetch app profile from our profiles table
    const fetchAppProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await database
                .from(TABLES.PROFILES)
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('[InsforgeAuth] Error fetching profile:', error);
                return null;
            }

            return data as AppProfile;
        } catch (error) {
            console.error('[InsforgeAuth] Error fetching profile:', error);
            return null;
        }
    }, []);

    // Create initial profile for new users
    const createInitialProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await database
                .from(TABLES.PROFILES)
                .insert([{
                    user_id: userId,
                    credits: 10,
                    tier: 'free'
                }])
                .select()
                .single();

            if (error) {
                console.error('[InsforgeAuth] Error creating profile:', error);
                return null;
            }

            return data as AppProfile;
        } catch (error) {
            console.error('[InsforgeAuth] Error creating profile:', error);
            return null;
        }
    }, []);

    // Check for existing session on mount
    const checkAuth = useCallback(async (): Promise<boolean> => {
        try {
            const { data, error } = await insforge.auth.getCurrentSession();

            if (error || !data?.session) {
                setIsAuthenticated(false);
                setUser(null);
                setAppProfile(null);
                setIsVerified(false);
                setIsLoading(false);
                return false;
            }

            const sessionUser = data.session.user;
            setUser(sessionUser as User);
            setIsAuthenticated(true);
            setIsVerified(sessionUser.emailVerified || false);

            // Fetch app profile
            let profile = await fetchAppProfile(sessionUser.id);
            if (!profile) {
                // Create profile if it doesn't exist
                profile = await createInitialProfile(sessionUser.id);
            }
            setAppProfile(profile);

            // Check for linked Instagram accounts
            const { data: igData } = await database
                .from(TABLES.IG_ACCOUNTS)
                .select('id')
                .eq('user_id', sessionUser.id)
                .limit(1);

            setHasLinkedInstagram(igData && igData.length > 0);

            return true;
        } catch (error) {
            console.error('[InsforgeAuth] Error checking auth:', error);
            setIsAuthenticated(false);
            setUser(null);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [fetchAppProfile, createInitialProfile]);

    // Login with email/password
    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await insforge.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data?.user) {
                setUser(data.user as User);
                setIsAuthenticated(true);
                setIsVerified(data.user.emailVerified || false);

                // Fetch profile
                const profile = await fetchAppProfile(data.user.id);
                setAppProfile(profile);
            }

            return { success: true };
        } catch (error) {
            console.error('[InsforgeAuth] Login error:', error);
            return { success: false, error: 'Login failed. Please try again.' };
        }
    }, [fetchAppProfile]);

    // Login with Google OAuth
    const loginWithGoogle = useCallback(async () => {
        try {
            await insforge.auth.signInWithOAuth({
                provider: 'google',
                redirectTo: `${window.location.origin}/dashboard`
            });
        } catch (error) {
            console.error('[InsforgeAuth] Google login error:', error);
            throw error;
        }
    }, []);

    // Register new user
    const register = useCallback(async (
        email: string,
        password: string,
        name: string
    ): Promise<{ success: boolean; requiresVerification?: boolean; error?: string }> => {
        try {
            const { data, error } = await insforge.auth.signUp({
                email,
                password,
                name,
                options: {
                    emailRedirectTo: `${window.location.origin}/verify-email`
                }
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data?.requireEmailVerification) {
                return { success: true, requiresVerification: true };
            }

            // If no verification required, user is logged in
            if (data?.user && data?.accessToken) {
                setUser(data.user as User);
                setIsAuthenticated(true);

                // Create initial profile
                const profile = await createInitialProfile(data.user.id);
                setAppProfile(profile);
            }

            return { success: true };
        } catch (error) {
            console.error('[InsforgeAuth] Register error:', error);
            return { success: false, error: 'Registration failed. Please try again.' };
        }
    }, [createInitialProfile]);

    // Logout
    const logout = useCallback(async () => {
        try {
            await insforge.auth.signOut();
        } catch (error) {
            console.error('[InsforgeAuth] Logout error:', error);
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            setAppProfile(null);
            setIsVerified(false);
            setHasLinkedInstagram(false);
        }
    }, []);

    // Verify email with code
    const verifyEmail = useCallback(async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await insforge.auth.verifyEmail({
                email,
                otp: code
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data?.user) {
                setUser(data.user as User);
                setIsAuthenticated(true);
                setIsVerified(true);

                // Fetch or create profile
                let profile = await fetchAppProfile(data.user.id);
                if (!profile) {
                    profile = await createInitialProfile(data.user.id);
                }
                setAppProfile(profile);
            }

            return { success: true };
        } catch (error) {
            console.error('[InsforgeAuth] Verify email error:', error);
            return { success: false, error: 'Verification failed. Please try again.' };
        }
    }, [fetchAppProfile, createInitialProfile]);

    // Resend verification email
    const resendVerificationEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await insforge.auth.resendVerificationEmail({ email });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: data?.success || false };
        } catch (error) {
            console.error('[InsforgeAuth] Resend verification error:', error);
            return { success: false, error: 'Failed to resend verification email.' };
        }
    }, []);

    // Reset password
    const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await insforge.auth.sendResetPasswordEmail({ email });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: data?.success || false };
        } catch (error) {
            console.error('[InsforgeAuth] Reset password error:', error);
            return { success: false, error: 'Failed to send reset password email.' };
        }
    }, []);

    // Refresh profile data
    const refreshProfile = useCallback(async () => {
        if (user?.id) {
            const profile = await fetchAppProfile(user.id);
            setAppProfile(profile);
        }
    }, [user?.id, fetchAppProfile]);

    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isLoading,
            isVerified,
            user,
            appProfile,
            hasPassword: true, // Insforge uses password auth
            hasLinkedInstagram,
            login,
            loginWithGoogle,
            register,
            logout,
            verifyEmail,
            resendVerificationEmail,
            resetPassword,
            checkAuth,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default InsforgeAuthProvider;
