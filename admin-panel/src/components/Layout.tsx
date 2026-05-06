import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    Users,
    LayoutDashboard,
    BarChart3,
    Settings,
    LogOut,
    BadgeDollarSign,
    Sparkles,
    TicketPercent,
    Mail,
    Sun,
    Moon,
    Menu,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';

const SIDEBAR_STORAGE_KEY = 'dm-panda-admin-sidebar-expanded';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/automations', icon: Sparkles, label: 'Automations' },
    { to: '/pricing', icon: BadgeDollarSign, label: 'Pricing' },
    { to: '/coupons', icon: TicketPercent, label: 'Coupons' },
    { to: '/email-campaigns', icon: Mail, label: 'Email Campaigns' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

const resolveHeaderMeta = (pathname: string) => {
    if (pathname.startsWith('/analytics')) return { title: 'Analytics', subtitle: 'Signals and trends' };
    if (pathname.startsWith('/users')) return { title: 'Users', subtitle: 'Plans and account access' };
    if (pathname.startsWith('/automations')) return { title: 'Automations', subtitle: 'Execution controls' };
    if (pathname.startsWith('/pricing')) return { title: 'Pricing', subtitle: 'Plans and limits' };
    if (pathname.startsWith('/coupons')) return { title: 'Coupons', subtitle: 'Offers and redemptions' };
    if (pathname.startsWith('/email-campaigns')) return { title: 'Campaigns', subtitle: 'Audience and delivery' };
    if (pathname.startsWith('/settings')) return { title: 'Settings', subtitle: 'System controls' };
    return { title: 'Overview', subtitle: 'Admin control center' };
};

export const Layout: React.FC = () => {
    const { logout, user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [desktopNavExpanded, setDesktopNavExpanded] = useState(true);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const avatarUrl = `https://cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(user?.name || 'Administrator')}&width=100&height=100`;

    useEffect(() => {
        setMobileNavOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (saved === 'false') {
            setDesktopNavExpanded(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopNavExpanded ? 'true' : 'false');
    }, [desktopNavExpanded]);

    const desktopCollapsed = !desktopNavExpanded;
    const headerMeta = resolveHeaderMeta(location.pathname);

    const renderThemeToggle = (compact = false) => {
        if (compact) {
            return (
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-background/85 shadow-sm transition hover:border-primary/30"
                    aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                    title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                >
                    <span className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300',
                        theme === 'dark'
                            ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white'
                            : 'bg-gradient-to-br from-amber-300 via-orange-300 to-yellow-200 text-amber-700'
                    )}>
                        {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </span>
                </button>
            );
        }

        return (
            <button
                type="button"
                onClick={toggleTheme}
                className="group inline-flex w-full items-center justify-between rounded-full border border-border/80 bg-background/80 p-1 shadow-sm transition hover:border-primary/30"
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
                <span className="pl-3 text-[11px] font-black text-foreground">
                    {theme === 'light' ? 'Light' : 'Dark'}
                </span>
                <span
                    className={cn(
                        'relative flex h-10 w-[78px] items-center rounded-full transition-all duration-300',
                        theme === 'dark'
                            ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700'
                            : 'bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200'
                    )}
                >
                    <span
                        className={cn(
                            'absolute top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-all duration-300',
                            theme === 'dark' ? 'left-[38px]' : 'left-1'
                        )}
                    >
                        {theme === 'dark'
                            ? <Moon className="h-4 w-4 text-slate-700" />
                            : <Sun className="h-4 w-4 text-amber-500" />}
                    </span>
                </span>
            </button>
        );
    };

    const renderDesktopNav = () => (
        <aside
            className={cn(
                'hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar/96 backdrop-blur-xl transition-all duration-300 lg:sticky lg:top-0 lg:flex lg:flex-col',
                desktopCollapsed ? 'lg:w-[88px]' : 'lg:w-64'
            )}
        >
            <div className={cn('border-b border-sidebar-border/70 px-4 py-4 sm:px-5')}>
                <div className={cn('relative', desktopCollapsed ? 'flex justify-center' : 'flex items-center gap-3 pr-12')}>
                    {desktopCollapsed ? (
                        <button
                            type="button"
                            onClick={() => setDesktopNavExpanded(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
                            aria-label="Open sidebar"
                            title="Open sidebar"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    ) : (
                        <>
                            <div className="min-w-0">
                                <p className="font-display text-[1.2rem] font-extrabold tracking-tight text-foreground">DM Panda</p>
                                <p className="text-[10px] font-black text-muted-foreground">admin panel</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDesktopNavExpanded(false)}
                                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
                                aria-label="Close sidebar"
                                title="Close sidebar"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <nav className={cn('custom-scrollbar flex-1 space-y-1.5 overflow-y-auto py-4', desktopCollapsed ? 'px-3' : 'px-4')}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={desktopCollapsed ? item.label : undefined}
                        className={({ isActive }) => cn(
                            'group flex items-center rounded-xl text-sm font-bold transition-all duration-200',
                            desktopCollapsed ? 'justify-center px-2 py-2.5' : 'space-x-3 px-3 py-2.5',
                            isActive
                                ? 'bg-ig-gradient text-white shadow-[0_18px_40px_rgba(131,58,180,0.22)]'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                    >
                        <item.icon className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                        {!desktopCollapsed && <span className="truncate font-bold">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className={cn('space-y-4 border-t border-sidebar-border bg-sidebar/80 pb-5 pt-5', desktopCollapsed ? 'px-3' : 'px-5')}>
                {renderThemeToggle(desktopCollapsed)}

                <div
                    className={cn(
                        'w-full overflow-hidden rounded-2xl border border-sidebar-border bg-card shadow-sm transition-all duration-200',
                        'hover:border-primary/30 hover:shadow-md',
                        desktopCollapsed ? 'mx-auto flex h-11 w-11 items-center justify-center rounded-full p-2.5' : 'flex items-center gap-2 p-2.5 sm:p-3 min-h-[52px]'
                    )}
                >
                    <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-ig-purple/0 via-ig-pink/5 to-ig-yellow/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="rounded-full bg-border p-[2px]">
                            <img
                                src={avatarUrl}
                                alt={user?.name || 'Administrator'}
                                className="h-8 w-8 rounded-full border-2 border-card object-cover"
                            />
                        </div>
                    </div>
                    {!desktopCollapsed && (
                        <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-xs font-medium text-foreground">{user?.name || 'Administrator'}</p>
                            <p className="text-2xs font-medium uppercase tracking-wide text-success">Connected</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={cn(
                            'rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive',
                            desktopCollapsed && 'hidden'
                        )}
                        title="Sign Out"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );

    return (
        <div className="flex h-[100dvh] max-w-full overflow-hidden bg-background text-foreground transition-colors duration-300">
            {renderDesktopNav()}

            {mobileNavOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <div className="relative z-10 flex h-full w-72 max-w-[calc(100vw-1.5rem)] flex-col border-r border-sidebar-border bg-sidebar/96 shadow-2xl backdrop-blur-xl">
                        <div className="border-b border-sidebar-border px-4 py-4 sm:px-5">
                    <div className="relative flex items-center gap-3 pr-12">
                                <div>
                                    <h2 className="font-display text-[1.2rem] font-extrabold tracking-tight text-foreground">DM Panda</h2>
                                    <p className="text-[10px] font-black text-muted-foreground">admin panel</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMobileNavOpen(false)}
                                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <nav className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => cn(
                                        'group flex items-center space-x-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200',
                                        isActive
                                            ? 'bg-ig-gradient text-white shadow-[0_18px_40px_rgba(131,58,180,0.22)]'
                                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                    )}
                                >
                                    <item.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                                    <span className="font-bold">{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>

                        <div className="space-y-4 border-t border-sidebar-border bg-sidebar/80 p-5">
                            {renderThemeToggle()}

                            <div className="glass-card flex items-center space-x-3 rounded-[24px] p-4">
                                <img
                                    src={avatarUrl}
                                    alt={user?.name || 'Administrator'}
                                    className="h-11 w-11 rounded-full border-2 border-card object-cover shadow-md"
                                />
                                <div className="flex-1 overflow-hidden">
                                    <p className="truncate text-sm font-bold tracking-tight text-foreground">{user?.name || 'Administrator'}</p>
                                    <p className="truncate text-[10px] font-medium text-muted-foreground">Active Now</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="rounded-xl p-2 text-muted-foreground transition-all duration-200 hover:bg-destructive-muted/60 hover:text-destructive"
                                    title="Sign Out"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="ig-topline relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background/55 transition-colors duration-300">
                <header className="sticky top-0 z-20 border-b border-white/10 bg-[#23282f]/94 px-4 py-4 shadow-[0_18px_42px_-32px_rgba(15,23,42,0.85)] backdrop-blur-xl sm:px-6 sm:py-4 lg:px-8">
                    <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-3 sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setMobileNavOpen(true)}
                                    className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[16px] border border-border bg-card shadow-sm lg:hidden"
                                >
                                    <Menu className="h-5 w-5 text-foreground" />
                                </button>
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-[10px] font-black text-muted-foreground sm:tracking-[0.28em]">Admin Panel</p>
                                <h2 className="mt-1 truncate text-base font-extrabold text-foreground sm:text-lg">{headerMeta.title}</h2>
                            </div>
                        </div>
                        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
                            <div className="status-pill status-pill-success shrink-0">
                                <span className="h-2 w-2 rounded-full bg-success" />
                                Live
                            </div>
                            <div className="max-w-full truncate rounded-full border border-border/80 bg-card/80 px-4 py-2 text-xs font-semibold text-muted-foreground">
                                {headerMeta.subtitle}
                            </div>
                        </div>
                    </div>
                </header>
                <div className="custom-scrollbar relative mx-auto min-h-0 w-full max-w-[1480px] flex-1 overflow-x-clip overflow-y-auto px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8">
                    <Outlet />
                </div>
                <div className="pointer-events-none absolute inset-0 z-[120]" data-admin-section-overlay-root />
            </main>
        </div>
    );
};
