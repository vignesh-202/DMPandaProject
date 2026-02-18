/**
 * Insforge Client Configuration
 * 
 * This file creates and exports the Insforge client instance
 * for use throughout the application.
 * 
 * Migration Note: This replaces the appwrite.ts client
 */

import { createClient } from '@insforge/sdk';

// Environment variables
const INSFORGE_BASE_URL = import.meta.env.VITE_INSFORGE_BASE_URL || 'https://kkqnp7i4.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY || '';

// Create and export the Insforge client
export const insforge = createClient({
    baseUrl: INSFORGE_BASE_URL,
    anonKey: INSFORGE_ANON_KEY
});

// Export individual services for convenience
export const auth = insforge.auth;
export const database = insforge.database;
export const storage = insforge.storage;
export const functions = insforge.functions;
export const realtime = insforge.realtime;

// Type exports for TypeScript
export type InsforgeClient = typeof insforge;

// Helper function to check if Insforge is properly configured
export const isInsforgeConfigured = (): boolean => {
    return Boolean(INSFORGE_BASE_URL && INSFORGE_ANON_KEY);
};

// Constants for table names (migration helper)
export const TABLES = {
    PROFILES: 'profiles',
    SETTINGS: 'settings',
    TRANSACTIONS: 'transactions',
    IG_ACCOUNTS: 'ig_accounts',
    CAMPAIGNS: 'campaigns',
} as const;

// Constants for storage buckets
export const BUCKETS = {
    MEDIA: 'media',
    AVATARS: 'avatars',
} as const;
