import React, { createContext, useContext, useEffect, useState } from 'react';
import httpClient from '../lib/httpClient';

type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'dm-panda-admin-theme';

const getSystemTheme = (): Theme => (
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

const getStoredTheme = (): Theme | null => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => getStoredTheme() || getSystemTheme());
    const [hasExplicitPreference, setHasExplicitPreference] = useState<boolean>(() => Boolean(getStoredTheme()));

    useEffect(() => {
        let active = true;
        httpClient.get('/api/settings')
            .then(() => {
                if (!active) return;
                const storedTheme = getStoredTheme();
                if (storedTheme) {
                    setTheme(storedTheme);
                    setHasExplicitPreference(true);
                    return;
                }

                setTheme(getSystemTheme());
            })
            .catch(() => {
                if (!active) return;
                setTheme(getSystemTheme());
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (event: MediaQueryListEvent) => {
            if (hasExplicitPreference) return;
            setTheme(event.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleThemeChange);
        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, [hasExplicitPreference]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            const nextTheme = prev === 'light' ? 'dark' : 'light';
            window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
            setHasExplicitPreference(true);
            httpClient.post('/api/settings', { dark_mode: nextTheme === 'dark' }).catch(() => { });
            return nextTheme;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
