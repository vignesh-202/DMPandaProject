import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';

interface ThemeContextProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setForceLightMode: (force: boolean) => void;
  theme: 'light' | 'dark'; // Add this to match usage in Navbar
}

export const ThemeContext = createContext<ThemeContextProps>({
  isDarkMode: false,
  toggleTheme: () => { },
  setForceLightMode: () => { },
  theme: 'light',
});

const getInitialTheme = (): boolean => {
  const sessionTheme = sessionStorage.getItem('theme');
  if (sessionTheme) {
    return sessionTheme === 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme());
  const [forceLightMode, setForceLightMode] = useState(false);

  useEffect(() => {
    if (forceLightMode) {
      document.documentElement.classList.remove('dark');
    } else if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, forceLightMode]);

  const toggleTheme = useCallback(() => {
    if (forceLightMode) return;
    setIsDarkMode(prev => {
      const newMode = !prev;
      sessionStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  }, [forceLightMode]);

  const value = useMemo(() => ({
    isDarkMode,
    toggleTheme,
    setForceLightMode,
    theme: isDarkMode ? 'dark' : 'light' as 'dark' | 'light'
  }), [isDarkMode, toggleTheme, forceLightMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);