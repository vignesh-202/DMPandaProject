import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

interface AuthContextProps {
  isAuthenticated: boolean | null;
  authHint: boolean;
  isLoading: boolean;
  isVerified: boolean;
  user: any; // Consider creating a specific User type
  accessState?: {
    ban_mode?: string;
    ban_message?: string | null;
    automation_locked?: boolean;
    dashboard_allowed?: boolean;
    login_allowed?: boolean;
    is_soft_banned?: boolean;
    is_hard_banned?: boolean;
  } | null;
  hasPassword?: boolean;
  hasLinkedInstagram?: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  checkHasPassword: (force?: boolean) => Promise<void>;
  setHasPasswordManually: (value: boolean) => void;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextProps>({
  isAuthenticated: null,
  authHint: false,
  isLoading: true,
  isVerified: false,
  user: null,
  accessState: null,
  login: async () => false,
  logout: () => { },
  checkAuth: async () => false,
  checkHasPassword: async () => { },
  setHasPasswordManually: () => { },
  authenticatedFetch: async () => new Response(),
});

export const useAuth = () => useContext(AuthContext);

const AUTH_HINT_KEY = 'dm_panda_auth_hint';
const FRONTEND_APP_CONTEXT = 'frontend';

const shouldAutoCheckAuth = () => {
  if (typeof window === 'undefined') return true;

  if (readAuthHint()) {
    return true;
  }

  const pathname = window.location.pathname || '/';
  return pathname.startsWith('/dashboard');
};

const readAuthHint = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

const writeAuthHint = (value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(AUTH_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTH_HINT_KEY);
    }
  } catch {
    // Ignore storage errors and keep the in-memory state.
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const autoCheckAuth = shouldAutoCheckAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(autoCheckAuth ? null : false);
  const [authHint, setAuthHint] = useState<boolean>(() => readAuthHint());
  const [isLoading, setIsLoading] = useState(autoCheckAuth);
  const [user, setUser] = useState<any>(null);
  const [accessState, setAccessState] = useState<AuthContextProps['accessState']>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | undefined>(undefined);
  const [hasLinkedInstagram, setHasLinkedInstagram] = useState<boolean | undefined>(undefined);
  const hasPasswordRef = React.useRef(hasPassword);
  const inFlightGetRef = React.useRef<Map<string, Promise<{ status: number; statusText: string; headers: Headers; body: ArrayBuffer }>>>(new Map());
  const checkAuthPromiseRef = React.useRef<Promise<boolean> | null>(null);
  const sessionValidationPromiseRef = React.useRef<Promise<boolean> | null>(null);

  const applyFrontendHeaders = useCallback((init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('X-App-Context', FRONTEND_APP_CONTEXT);
    return headers;
  }, []);

  useEffect(() => {
    hasPasswordRef.current = hasPassword;
  }, [hasPassword]);

  const setHasPasswordManually = useCallback((value: boolean) => {
    setHasPassword(value);
    hasPasswordRef.current = value;
  }, []);

  const checkHasPassword = useCallback(async (force: boolean = false) => {
    if (!force && hasPasswordRef.current !== undefined) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/account/has-password`, {
        credentials: 'include',
        headers: applyFrontendHeaders(),
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
  }, [applyFrontendHeaders]);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (checkAuthPromiseRef.current) {
      return checkAuthPromiseRef.current;
    }

    const promise = (async (): Promise<boolean> => {
    // Don't set loading to true for background checks if we are already authenticated
    if (isAuthenticated === null) {
      setIsLoading(true);
    }

    try {
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/me`;

      const response = await fetch(apiUrl, {
        credentials: 'include',
        headers: applyFrontendHeaders(),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setAccessState(userData?.access_state || null);
        setIsAuthenticated(true);
        setAuthHint(true);
        writeAuthHint(true);
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
        if (response.status === 403) {
          let payload: any = null;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
          const deniedAccessState = payload?.access_state || payload?.access_state || payload?.data?.access_state || payload?.data?.accessState || null;
          const denyMessage = payload?.message || payload?.error || payload?.data?.error || deniedAccessState?.ban_message || 'Your account has been blocked.';
          setUser(null);
          setAccessState(deniedAccessState);
          setIsAuthenticated(false);
          setAuthHint(false);
          writeAuthHint(false);
          setIsVerified(false);
          setHasPassword(false);
          setHasLinkedInstagram(false);

          if (typeof window !== 'undefined' && deniedAccessState?.is_hard_banned) {
            const params = new URLSearchParams({
              popup_reason: 'hard_ban',
              message: denyMessage,
            });
            window.location.replace(`/login?${params.toString()}`);
          }
        }
        if (response.status === 401) {
          setUser(null);
          setAccessState(null);
          setIsAuthenticated(false);
          setAuthHint(false);
          writeAuthHint(false);
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
    })();

    checkAuthPromiseRef.current = promise.finally(() => {
      checkAuthPromiseRef.current = null;
    });

    return checkAuthPromiseRef.current;
  }, [applyFrontendHeaders, checkHasPassword, isAuthenticated]);

  const login = useCallback(async () => {
    return checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    // Update state immediately for a smooth UI transition.
    setIsAuthenticated(false);
    setAuthHint(false);
    writeAuthHint(false);
    setUser(null);
    setAccessState(null);
    setIsVerified(false);
    setHasPassword(false);
    setHasLinkedInstagram(false);

    // Perform the backend logout in the background (fire and forget).
    fetch(`${import.meta.env.VITE_API_BASE_URL}/logout`, {
      credentials: 'include',
      headers: applyFrontendHeaders(),
    }).catch(error => {
      console.error("Background logout failed:", error);
    });
  }, [applyFrontendHeaders]);

  const validateActiveSession = useCallback(async () => {
    if (sessionValidationPromiseRef.current) {
      return sessionValidationPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/me`, {
          credentials: 'include',
          headers: applyFrontendHeaders(),
        });
        return response.ok;
      } catch {
        return true;
      }
    })();

    sessionValidationPromiseRef.current = promise.finally(() => {
      sessionValidationPromiseRef.current = null;
    });

    return sessionValidationPromiseRef.current;
  }, [applyFrontendHeaders]);

  // Authenticated Fetch Helper - Does NOT auto-logout on password validation 401 errors
  const authenticatedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = applyFrontendHeaders(init);

    const method = (init?.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : String(input));
    const shouldCoalesce = method === 'GET' && !init?.body && !init?.signal;

    const performFetch = async () => {
      const response = await fetch(input, { ...init, headers, credentials: 'include' });
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

        // Only log out after confirming the session is actually gone.
        if (response.status === 401) {
          const isSessionActive = url.includes('/api/me')
            ? false
            : await validateActiveSession();
          if (!isSessionActive) {
            console.warn('[AuthContext] Confirmed session expiry after 401 response. Logging out.');
            logout();
          }
        }

        return response;
      }

      const response = await fetch(input, { ...init, headers, credentials: 'include' });

      // Only log out after confirming the session is actually gone.
      if (response.status === 401) {
        const isSessionActive = url.includes('/api/me')
          ? false
          : await validateActiveSession();
        if (!isSessionActive) {
          console.warn('[AuthContext] Confirmed session expiry after 401 response. Logging out.');
          logout();
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  }, [applyFrontendHeaders, logout, validateActiveSession]);

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
    if (shouldAutoCheckAuth()) {
      void checkAuth();
      return;
    }

    setIsLoading(false);
    setIsAuthenticated(false);
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, authHint, isLoading, isVerified, user, accessState, hasPassword, hasLinkedInstagram, login, logout, checkAuth, checkHasPassword, setHasPasswordManually, authenticatedFetch }}>
      {children}
    </AuthContext.Provider>
  );
};
