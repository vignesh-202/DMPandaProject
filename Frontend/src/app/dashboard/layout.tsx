import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './sidebar';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Sun, Moon, X, ChevronRight, LogOut, Settings, Bell, AlertTriangle, CalendarClock } from 'lucide-react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { ThemeContext } from '../../contexts/ThemeContext';
import DashboardLoading from '../../components/ui/DashboardLoading';
import { useLoading } from '../../contexts/LoadingContext';
import { cn } from '../../lib/utils';
import { writeTransientState } from '../../lib/transientState';

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
    return window.innerWidth >= 1024;
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { currentView, setCurrentView, activeAccountID, setActiveAccountID, isInitialLoadComplete } = useDashboard();
  const { logout, user, authenticatedFetch, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isAppLoading } = useLoading();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
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
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

    setIsNotificationsLoading(true);
    try {
      const requests: Promise<Response | null>[] = [
        authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/my-plan`)
      ];

      if (activeAccountID) {
        requests.push(
          authenticatedFetch(
            `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automation-activity-log?account_id=${encodeURIComponent(activeAccountID)}&limit=100`
          )
        );
      } else {
        requests.push(Promise.resolve(null));
      }

      const [planResponse, logsResponse] = await Promise.all(requests);
      const [planPayload, logsPayload] = await Promise.all([
        planResponse?.ok ? planResponse.json().catch(() => null) : null,
        logsResponse?.ok ? logsResponse.json().catch(() => null) : null
      ]);

      const nextNotifications: DashboardNotification[] = [];
      const expiryCopy = getExpiryNotificationCopy(
        String(planPayload?.details?.name || 'Your subscription'),
        String(planPayload?.expires || '')
      );

      if (expiryCopy) {
        nextNotifications.push({
          id: `subscription-expiring:${String(planPayload?.expires || '')}`,
          kind: 'subscription_expiring',
          title: expiryCopy.title,
          description: expiryCopy.description,
          createdAt: String(planPayload?.expires || new Date().toISOString()),
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
      setIsNotificationsLoading(false);
    }
  }, [activeAccountID, authenticatedFetch, isInitialLoadComplete]);

  useEffect(() => {
    void fetchNotifications();
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 60000);

    return () => window.clearInterval(intervalId);
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
        "fixed inset-0 bg-foreground/20 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-200",
        isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={() => setIsSidebarOpen(false)}
    />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 h-full flex flex-col transition-all duration-300 ease-out lg:relative z-30",
          "bg-sidebar border-r border-sidebar-border shadow-sm",
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-64 -translate-x-full lg:w-[72px] lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="border-b border-sidebar-border px-4 sm:px-6 py-3.5">
          {isSidebarOpen ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
              <div aria-hidden />
              <Link to="/" className="justify-self-center transition-opacity hover:opacity-80">
                <h1 className="font-display truncate text-[2rem] font-extrabold tracking-tight text-foreground">
                  DM Panda
                </h1>
              </Link>
              <button
                onClick={toggleSidebar}
                className="absolute top-2 right-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Menu size={18} />
              </button>
            </div>
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
        <header className="ig-topline sticky top-0 z-[160] flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 shadow-sm sm:px-6 sm:py-3">
          {/* Left Side - Mobile Menu + Breadcrumb */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={toggleSidebar}
              data-sidebar-toggle
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb - Instagram themed */}
            <nav className="flex min-w-0 items-center text-sm font-medium">
              <button
                onClick={() => setCurrentView('Overview')}
                className={cn(
                  "transition-colors duration-200 hover:text-primary",
                  currentView === 'Overview'
                    ? "ig-gradient-text font-semibold"
                    : "text-muted-foreground"
                )}
              >
                Overview
              </button>
              {currentView !== 'Overview' && (
                <>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mx-2 flex-shrink-0" />
                  <span className="ig-gradient-text font-semibold truncate">
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
                  'relative flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:text-foreground',
                  unreadNotificationCount > 0 && 'border-primary/40 text-primary shadow-primary/10'
                )}
                aria-label="Notifications"
                aria-expanded={isNotificationMenuOpen}
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[1.15rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground shadow-lg">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              <div className={cn(
                'ig-topline absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg z-[180] transition-all duration-200 origin-top-right',
                isNotificationMenuOpen
                  ? 'visible translate-y-0 scale-100 opacity-100'
                  : 'invisible -translate-y-2 scale-95 opacity-0'
              )}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadNotificationCount > 0 ? `${unreadNotificationCount} unread item${unreadNotificationCount === 1 ? '' : 's'}` : 'All caught up'}
                    </p>
                  </div>
                </div>

                <div className="max-h-[24rem] overflow-y-auto">
                  {isNotificationsLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Bell className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        We’ll alert you about expiring subscriptions and automation processing errors here.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {notifications.map((notification) => {
                        const isUnread = !seenNotificationIds.includes(notification.id);
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              'mb-1.5 flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-primary/10',
                              isUnread ? 'bg-primary/5' : 'bg-transparent'
                            )}
                          >
                            <div className={cn(
                              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
                              notification.kind === 'subscription_expiring'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-rose-500/10 text-rose-600'
                            )}>
                              {notification.kind === 'subscription_expiring'
                                ? <CalendarClock className="h-4.5 w-4.5" />
                                : <AlertTriangle className="h-4.5 w-4.5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">
                                  {notification.title}
                                </p>
                                {isUnread && (
                                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                                )}
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {notification.description}
                              </p>
                              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
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
                className="relative p-[2px] rounded-full transition-all duration-200 bg-border hover:bg-border-hover shadow-sm group"
              >
                {user ? (
                  <img
                    src={`https://cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(user.name)}&width=100&height=100`}
                    alt={user.name}
                    className="w-[30px] h-[30px] sm:w-[36px] sm:h-[36px] rounded-full object-cover border-2 border-card transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-[30px] h-[30px] sm:w-[36px] sm:h-[36px] rounded-full bg-card flex items-center justify-center border-2 border-card transition-transform duration-200 group-hover:scale-105">
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {userInitials}
                    </span>
                  </div>
                )}
              </button>

              {/* Profile Dropdown - Instagram themed */}
              <div className={cn(
                "ig-topline absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-lg overflow-hidden z-[180] transition-all duration-200 origin-top-right",
                isProfileMenuOpen
                  ? "opacity-100 scale-100 translate-y-0 visible"
                  : "opacity-0 scale-95 -translate-y-2 invisible"
              )}>
                {/* User Info */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Signed in as
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user?.name}
                  </p>
                  {user?.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  {/* Theme Toggle - Instagram styled */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors duration-200 gap-3">
                    <span className="flex items-center gap-3 text-sm text-foreground flex-shrink-0">
                      {isDarkMode ? (
                        <Moon size={18} className="text-primary flex-shrink-0" />
                      ) : (
                        <Sun size={18} className="text-ig-yellow flex-shrink-0" />
                      )}
                      <span className="whitespace-nowrap">Dark Mode</span>
                    </span>
                    <div className="flex-shrink-0">
                      <ToggleSwitch isChecked={isDarkMode} onChange={toggleTheme} />
                    </div>
                  </div>

                  {/* Settings */}
                  <button
                    onClick={() => {
                      setCurrentView('Account Settings');
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground rounded-xl hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                  >
                    <Settings size={18} className="text-muted-foreground" />
                    Settings
                  </button>

                  {/* Logout */}
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive rounded-xl hover:bg-destructive/10 transition-colors duration-200 font-medium"
                  >
                    <LogOut size={18} />
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
            className="h-full overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6"
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
