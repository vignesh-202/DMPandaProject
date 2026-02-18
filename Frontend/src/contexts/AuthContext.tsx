import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

interface AuthContextProps {
  isAuthenticated: boolean | null;
  isLoading: boolean;
  isVerified: boolean;
  user: any; // Consider creating a specific User type
  hasPassword?: boolean;
  hasLinkedInstagram?: boolean;
  login: () => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  checkHasPassword: (force?: boolean) => Promise<void>;
  setHasPasswordManually: (value: boolean) => void;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextProps>({
  isAuthenticated: null,
  isLoading: true,
  isVerified: false,
  user: null,
  login: async () => {
    // This function can be used to manually trigger a re-check of auth state
  },
  logout: () => { },
  checkAuth: async () => false,
  checkHasPassword: async () => { },
  setHasPasswordManually: () => { },
  authenticatedFetch: async () => new Response(),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | undefined>(undefined);
  const [hasLinkedInstagram, setHasLinkedInstagram] = useState<boolean | undefined>(undefined);
  const hasPasswordRef = React.useRef(hasPassword);
  const inFlightGetRef = React.useRef<Map<string, Promise<{ status: number; statusText: string; headers: Headers; body: ArrayBuffer }>>>(new Map());

  useEffect(() => {
    hasPasswordRef.current = hasPassword;
  }, [hasPassword]);

  const setHasPasswordManually = useCallback((value: boolean) => {
    setHasPassword(value);
    hasPasswordRef.current = value;
  }, []);

  const checkHasPassword = useCallback(async (force: boolean = false) => {
    if (!force && hasPasswordRef.current !== undefined) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setHasPassword(false);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/has-password`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHasPassword(data.hasPassword);
      } else {
        setHasPassword(false);
      }
    } catch (error) {
      setHasPassword(false);
    }
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem('token');

    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      setIsVerified(false);
      setIsLoading(false);
      return false;
    }

    // Don't set loading to true for background checks if we are already authenticated
    if (isAuthenticated === null) {
      setIsLoading(true);
    }

    try {
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/me`;

      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
        setIsVerified(userData.emailVerification || false);

        // Set hasPassword directly from user data if available
        if (userData.hasPassword !== undefined) {
          setHasPassword(userData.hasPassword);
        } else {
          // Fallback if the field is missing for some reason
          await checkHasPassword();
        }

        // Set hasLinkedInstagram from user data
        setHasLinkedInstagram(userData.hasLinkedInstagram || false);

        return true;
      } else {
        // If the token is invalid, remove it
        console.warn('[AuthContext] Invalid token, response status:', response.status);
        if (response.status === 401) {
          localStorage.removeItem('token');
          setUser(null);
          setIsAuthenticated(false);
          setIsVerified(false);
          setHasPassword(false);
          setHasLinkedInstagram(false);
        }
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Error during checkAuth:', error);
      // Don't remove token on network errors - keep it for retry
      // But return false to indicate check failed
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkHasPassword, isAuthenticated]);

  const login = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    const token = localStorage.getItem('token');

    // Update state immediately for a smooth UI transition.
    setIsAuthenticated(false);
    setUser(null);
    setIsVerified(false);
    setHasPassword(false);
    localStorage.removeItem('token');
    sessionStorage.removeItem('theme');

    // Perform the backend logout in the background (fire and forget).
    if (token) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/logout`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(error => {
        console.error("Background logout failed:", error);
      });
    }
  }, []);

  // Authenticated Fetch Helper - Does NOT auto-logout on password validation 401 errors
  const authenticatedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = localStorage.getItem('token');
    const headers = new Headers(init?.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const method = (init?.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : String(input));
    const shouldCoalesce = method === 'GET' && !init?.body && !init?.signal;

    const performFetch = async () => {
      const response = await fetch(input, { ...init, headers });
      const body = await response.arrayBuffer();
      const clonedHeaders = new Headers();
      response.headers.forEach((value, key) => clonedHeaders.set(key, value));
      return { status: response.status, statusText: response.statusText, headers: clonedHeaders, body };
    };

    try {
      if (shouldCoalesce) {
        let payload: { status: number; statusText: string; headers: Headers; body: ArrayBuffer };
        const existing = inFlightGetRef.current.get(url);
        if (existing) {
          payload = await existing;
        } else {
          const promise = performFetch().finally(() => {
            inFlightGetRef.current.delete(url);
          });
          inFlightGetRef.current.set(url, promise);
          payload = await promise;
        }
        const response = new Response(payload.body.slice(0), {
          status: payload.status,
          statusText: payload.statusText,
          headers: payload.headers
        });

        // Handle 401 statuses
        if (response.status === 401) {
          const checkClone = response.clone();
          try {
            const errorData = await checkClone.json();
            const isPasswordError = errorData.error && (
              errorData.error.toLowerCase().includes('password') ||
              errorData.error.toLowerCase().includes('invalid password')
            );
            if (!isPasswordError) {
              console.warn('[AuthContext] 401 Unauthorized detected. Logging out.');
              logout();
            }
          } catch {
            console.warn('[AuthContext] 401 Unauthorized detected. Logging out.');
            logout();
          }
        }

        return response;
      }

      const response = await fetch(input, { ...init, headers });

      // Handle 401 statuses
      if (response.status === 401) {
        const checkClone = response.clone();
        try {
          const errorData = await checkClone.json();
          const isPasswordError = errorData.error && (
            errorData.error.toLowerCase().includes('password') ||
            errorData.error.toLowerCase().includes('invalid password')
          );
          if (!isPasswordError) {
            console.warn('[AuthContext] 401 Unauthorized detected. Logging out.');
            logout();
          }
        } catch {
          console.warn('[AuthContext] 401 Unauthorized detected. Logging out.');
          logout();
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  }, [logout]);

  // Session Polling - Disabled to prevent auto-refreshing
  // useEffect(() => {
  //   if (!isAuthenticated) return;
  //
  //   const intervalId = setInterval(() => {
  //     checkAuth();
  //   }, 600000); // 600 seconds (10 minutes)
  //
  //   return () => clearInterval(intervalId);
  // }, [isAuthenticated, checkAuth]);

  useEffect(() => {
    checkAuth(); // Initial check on component mount

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, isVerified, user, hasPassword, hasLinkedInstagram, login, logout, checkAuth, checkHasPassword, setHasPasswordManually, authenticatedFetch }}>
      {children}
    </AuthContext.Provider>
  );
};
