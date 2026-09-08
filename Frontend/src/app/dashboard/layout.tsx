import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './sidebar';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Sun, Moon, X, ChevronRight, LogOut, Settings, Bell, AlertTriangle, CalendarClock, PanelLeftClose } from 'lucide-react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { ThemeContext } from '../../contexts/ThemeContext';
import DashboardLoading from '../../components/ui/DashboardLoading';
import { useLoading } from '../../contexts/LoadingContext';
import { cn } from '../../lib/utils';
import { writeTransientState } from '../../lib/transientState';
import { FAST_TRANSITION, SMOOTH_TRANSITION } from '../../lib/animation';

type DashboardNotification = {
  id: string;
  kind: 'subscription_expiring' | 'automation_error';
  title: string;
  description: string;
  createdAt: string;
  targetView: import('../../contexts/DashboardContext').ViewType;
  automationId?: string;
  automationType?: string;
  accountId?: string;
};

const NOTIFICATION_STORAGE_PREFIX = 'dm-panda:dashboard-notifications:seen';
const DASHBOARD_SIDEBAR_STORAGE_KEY = 'dm-panda:dashboard-sidebar-expanded';

const resolveNotificationTargetView = (
  automationTypeRaw: string
): import('../../contexts/DashboardContext').ViewType => {
  const automationType = String(automationTypeRaw || '').trim().toLowerCase();
  const map: Record<string, import('../../contexts/DashboardContext').ViewType> = {
    dm: 'DM Automation',
    global: 'Global Trigger',
    global_trigger: 'Global Trigger',
    comment: 'Post Automation',
    post: 'Post Automation',
    reel: 'Reel Automation',
    story: 'Story Automation',
    live: 'Live Automation',
    mentions: 'Mentions',
    mention: 'Mentions',
    suggest_more: 'Suggest More',
    welcome_message: 'Welcome Message',
    comment_moderation: 'Comment Moderation',
    inbox_menu: 'Inbox Menu',
    convo_starter: 'Convo Starter',
    super_profile: 'Super Profile'
  };

  return map[automationType] || 'Analytics';
};

const formatNotificationDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getExpiryNotificationCopy = (planName: string, expiresAt: string) => {
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expires);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0 || diffDays > 3) {
    return null;
  }

  const title = diffDays === 0
    ? 'Subscription expires today'
    : diffDays === 1
      ? 'Subscription expires tomorrow'
      : `Subscription expires in ${diffDays} days`;

  return {
    title,
    description: `${planName || 'Your plan'} ends on ${expires.toLocaleDateString()}.`
  };
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window === 'undefined') return true;
        if (window.innerWidth < 1024) return false;
        return window.localStorage.getItem(DASHBOARD_SIDEBAR_STORAGE_KEY) !== 'false';
    });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { currentView, setCurrentView, activeAccountID, setActiveAccountID, isInitialLoadComplete, planStatus } = useDashboard();
  const { logout, user, authenticatedFetch, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isAppLoading } = useLoading();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const notificationFetchInFlightRef = useRef(false);
  const userIdentifier = String(user?.$id || user?.id || user?.email || 'guest');
  const notificationStorageKey = `${NOTIFICATION_STORAGE_PREFIX}:${userIdentifier}`;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const persistSeenNotificationIds = useCallback((ids: string[]) => {
    const nextIds = Array.from(new Set(ids.filter(Boolean)));
    setSeenNotificationIds(nextIds);
    try {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(nextIds));
    } catch (_) {
      // Ignore storage failures and keep the in-memory state.
    }
  }, [notificationStorageKey]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
      if (window.innerWidth < 1024 && sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isSidebarOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-sidebar-toggle]')) {
          setIsSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentView]);

  // Handle responsive sidebar
  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    const syncSidebarState = (event?: MediaQueryListEvent) => {
      const matchesDesktop = event ? event.matches : desktopQuery.matches;
      if (!matchesDesktop) {
        setIsSidebarOpen(false);
        return;
      }

      setIsSidebarOpen(window.localStorage.getItem(DASHBOARD_SIDEBAR_STORAGE_KEY) !== 'false');
    };

    syncSidebarState();

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', syncSidebarState);
      return () => desktopQuery.removeEventListener('change', syncSidebarState);
    }

    desktopQuery.addListener(syncSidebarState);
    return () => desktopQuery.removeListener(syncSidebarState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    window.localStorage.setItem(DASHBOARD_SIDEBAR_STORAGE_KEY, isSidebarOpen ? 'true' : 'false');
  }, [isSidebarOpen]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSeenNotificationIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
    } catch (_) {
      setSeenNotificationIds([]);
    }
  }, [notificationStorageKey]);

  const fetchNotifications = useCallback(async () => {
    if (!isInitialLoadComplete) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (notificationFetchInFlightRef.current) return;

    notificationFetchInFlightRef.current = true;
    setIsNotificationsLoading(true);
    try {
      const logsResponse = activeAccountID
        ? await authenticatedFetch(
          `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automation-activity-log?account_id=${encodeURIComponent(activeAccountID)}&limit=100`
        )
        : null;
      const logsPayload = logsResponse?.ok ? await logsResponse.json().catch(() => null) : null;

      const nextNotifications: DashboardNotification[] = [];
      const expiryCopy = getExpiryNotificationCopy(
        String(planStatus.planName || 'Your subscription'),
        String(planStatus.expiresAt || '')
      );

      if (expiryCopy) {
        nextNotifications.push({
          id: `subscription-expiring:${String(planStatus.expiresAt || '')}`,
          kind: 'subscription_expiring',
          title: expiryCopy.title,
          description: expiryCopy.description,
          createdAt: String(planStatus.expiresAt || new Date().toISOString()),
          targetView: 'My Plan'
        });
      }

      const logs = Array.isArray(logsPayload?.logs) ? logsPayload.logs : [];
      const latestFailureByAutomation = new Map<string, any>();

      logs
        .filter((entry: any) => {
          const status = String(entry?.status || '').toLowerCase();
          return status === 'failed' || Boolean(String(entry?.error_reason || '').trim());
        })
        .forEach((entry: any) => {
          const key = String(entry?.automation_id || entry?.id || Math.random());
          const existing = latestFailureByAutomation.get(key);
          const nextTime = new Date(entry?.sent_at || entry?.created_at || 0).getTime();
          const currentTime = new Date(existing?.sent_at || existing?.created_at || 0).getTime();
          if (!existing || nextTime >= currentTime) {
            latestFailureByAutomation.set(key, entry);
          }
        });

      latestFailureByAutomation.forEach((entry) => {
        const automationType = String(entry?.automation_type || '').toLowerCase();
        nextNotifications.push({
          id: `automation-error:${String(entry?.id || entry?.automation_id || '')}`,
          kind: 'automation_error',
          title: 'Automation error detected',
          description: String(entry?.error_reason || entry?.message || 'Worker node reported a processing error.'),
          createdAt: String(entry?.sent_at || entry?.created_at || new Date().toISOString()),
          targetView: resolveNotificationTargetView(automationType),
          automationId: String(entry?.automation_id || ''),
          automationType,
          accountId: String(entry?.account_id || activeAccountID || '')
        });
      });

      nextNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(nextNotifications);
    } catch (error) {
      console.error('Failed to load dashboard notifications:', error);
      setNotifications([]);
    } finally {
      notificationFetchInFlightRef.current = false;
      setIsNotificationsLoading(false);
    }
  }, [activeAccountID, authenticatedFetch, isInitialLoadComplete, planStatus.expiresAt, planStatus.planName]);

  useEffect(() => {
    void fetchNotifications();
    const handleVisibilityOrFocus = () => {
      void fetchNotifications();
    };
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 60000);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isNotificationMenuOpen || notifications.length === 0) return;
    const nextSeenIds = Array.from(new Set([...seenNotificationIds, ...notifications.map((item) => item.id)]));
    if (nextSeenIds.length !== seenNotificationIds.length) {
      persistSeenNotificationIds(nextSeenIds);
    }
  }, [isNotificationMenuOpen, notifications, persistSeenNotificationIds, seenNotificationIds]);

  if (isAuthLoading || isAppLoading || !isInitialLoadComplete) {
    return <DashboardLoading />;
  }

  const userInitials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DM';

  const unreadNotificationCount = notifications.filter((item) => !seenNotificationIds.includes(item.id)).length;

  const handleNotificationClick = (notification: DashboardNotification) => {
    persistSeenNotificationIds([...seenNotificationIds, notification.id]);
    setIsNotificationMenuOpen(false);

    if (notification.accountId && notification.accountId !== activeAccountID) {
      setActiveAccountID(notification.accountId);
    }

    if (notification.automationId) {
      writeTransientState('openAutomationId', notification.automationId);
      writeTransientState('openAutomationType', String(notification.automationType || '').toLowerCase());
    }

    setCurrentView(notification.targetView);
  };

  return (
    <div className="flex h-[100dvh] max-w-full overflow-hidden bg-background">
      {/* Mobile Backdrop */}
      <div
        className={cn(
        `fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[240] lg:hidden ${FAST_TRANSITION}`,
        isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={() => setIsSidebarOpen(false)}
    />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          `fixed top-0 left-0 h-full max-w-[85vw] flex flex-col ${SMOOTH_TRANSITION} ease-out lg:relative lg:max-w-none z-[260]`,
          "bg-sidebar border-r border-sidebar-border shadow-sm",
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-64 -translate-x-full lg:w-[72px] lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn(
          "border-b border-border/80 flex items-center h-[72px] transition-all duration-200 bg-sidebar",
          isSidebarOpen ? "px-4 sm:px-5 justify-between" : "px-0 justify-center"
        )}>
          {isSidebarOpen ? (
            <>
              <Link to="/" className="flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-80">
                <img
                  src="/images/logo.png"
                  alt="DM Panda"
                  className="h-8 w-auto object-contain shrink-0"
                />
                <span className="font-display truncate text-lg font-bold tracking-tight text-foreground">
                  DM Panda
                </span>
              </Link>
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors flex items-center justify-center shrink-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-sidebar-accent active:scale-95 transition-all duration-150 flex items-center justify-center border border-border/60 shadow-xs"
              title="Expand Sidebar"
            >
              <img
                src="/images/logo.png"
                alt="DM Panda"
                className="h-6 w-auto object-contain"
              />
            </button>
          )}
        </div>

        {/* Sidebar Content */}
        <div className="flex min-h-0 flex-1">
          <Sidebar
            isCollapsed={!isSidebarOpen}
            onItemClick={() => {
              if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
              }
            }}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-[160] flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 shadow-xs sm:px-6 sm:py-3">
          {/* Left Side - Mobile Menu + Breadcrumb */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={toggleSidebar}
              data-sidebar-toggle
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb - Clean & refined */}
            <nav className="flex min-w-0 items-center text-sm font-medium">
              <button
                onClick={() => setCurrentView('Overview')}
                className={cn(
                  "transition-colors duration-150 hover:text-foreground",
                  currentView === 'Overview'
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground"
                )}
              >
                Overview
              </button>
              {currentView !== 'Overview' && (
                <>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 mx-2 flex-shrink-0" />
                  <span className="text-foreground font-semibold truncate">
                    {currentView}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right Side - Notifications + Profile */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div ref={notificationMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotificationMenuOpen((open) => !open);
                  setIsProfileMenuOpen(false);
                }}
                className={cn(
                  'relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground active:scale-95',
                  unreadNotificationCount > 0 && 'border-primary/40 text-primary'
                )}
                aria-label="Notifications"
                aria-expanded={isNotificationMenuOpen}
              >
                <Bell className={cn("h-4.5 w-4.5", unreadNotificationCount > 0 && "text-primary")} />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[1.1rem] h-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              <div className={cn(
                `fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+4.5rem)] w-auto overflow-hidden rounded-2xl border border-border bg-card shadow-xl z-[180] ${FAST_TRANSITION} origin-top sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] sm:max-w-[calc(100vw-1.5rem)] sm:origin-top-right`,
                isNotificationMenuOpen
                  ? 'visible translate-y-0 scale-100 opacity-100'
                  : 'invisible -translate-y-2 scale-95 opacity-0'
              )}>
                <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/20">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadNotificationCount > 0 ? `${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? '' : 's'}` : 'All caught up'}
                    </p>
                  </div>
                  {unreadNotificationCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                      {unreadNotificationCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-[min(65vh,24rem)] overflow-y-auto overscroll-contain divide-y divide-border/40">
                  {isNotificationsLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Bell className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                      <p className="mt-1 text-xs text-muted-foreground px-4">
                        We’ll alert you about expiring subscriptions and automation processing errors here.
                      </p>
                    </div>
                  ) : (
                    <div className="p-1.5 space-y-1">
                      {notifications.map((notification) => {
                        const isUnread = !seenNotificationIds.includes(notification.id);
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70',
                              isUnread ? 'bg-primary/[0.04]' : 'bg-transparent'
                            )}
                          >
                            <div className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                              notification.kind === 'subscription_expiring'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-destructive/10 text-destructive'
                            )}>
                              {notification.kind === 'subscription_expiring'
                                ? <CalendarClock className="h-4 w-4" />
                                : <AlertTriangle className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
                                  {notification.title}
                                </p>
                                {isUnread && (
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {notification.description}
                              </p>
                              <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                {formatNotificationDate(notification.createdAt)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div ref={profileMenuRef} className="relative flex items-center">
              <button
                onClick={() => {
                  setIsProfileMenuOpen(!isProfileMenuOpen);
                  setIsNotificationMenuOpen(false);
                }}
                className="relative p-0.5 rounded-xl border border-border bg-card hover:bg-muted hover:border-border/80 shadow-xs transition-all duration-150 group active:scale-95"
                aria-label="User Profile"
              >
                {user ? (
                  <img
                    src={`https://cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(user.name)}&width=100&height=100`}
                    alt={user.name}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                      (e.target as HTMLElement).nextElementSibling?.classList.add('flex');
                    }}
                  />
                ) : null}
                <div className={cn(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 items-center justify-center font-semibold text-xs sm:text-sm text-primary",
                  user ? "hidden" : "flex"
                )}>
                  {userInitials}
                </div>
              </button>

              {/* Profile Dropdown - Tasteful & Modern */}
              <div className={cn(
                `absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-[180] ${FAST_TRANSITION} origin-top-right`,
                isProfileMenuOpen
                  ? "opacity-100 scale-100 translate-y-0 visible"
                  : "opacity-0 scale-95 -translate-y-2 invisible"
              )}>
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-border/80 bg-muted/20">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                      {userInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.name || 'Account'}
                      </p>
                      {user?.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1.5 space-y-0.5">
                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted transition-colors duration-150 gap-3">
                    <span className="flex items-center gap-2.5 text-sm text-foreground">
                      {isDarkMode ? (
                        <Moon size={16} className="text-muted-foreground" />
                      ) : (
                        <Sun size={16} className="text-muted-foreground" />
                      )}
                      <span>Dark Mode</span>
                    </span>
                    <ToggleSwitch isChecked={isDarkMode} onChange={toggleTheme} />
                  </div>

                  {/* Settings */}
                  <button
                    onClick={() => {
                      setCurrentView('Account Settings');
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground rounded-xl hover:bg-muted transition-colors duration-150"
                  >
                    <Settings size={16} className="text-muted-foreground" />
                    Settings
                  </button>

                  <div className="my-1 border-t border-border/60" />

                  {/* Logout */}
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-destructive rounded-xl hover:bg-destructive/10 transition-colors duration-150"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="relative flex-1 min-h-0">
          <main
            ref={mainRef}
            className="h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] p-3 pb-24 sm:p-4 sm:pb-28 lg:p-6 lg:pb-6"
            data-dashboard-section-scroll-root
          >
            <div className="animate-fadeIn relative min-h-full">
              {children}
            </div>
          </main>
          <div className="pointer-events-none absolute inset-0 z-[120]" data-dashboard-section-overlay-root />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;

