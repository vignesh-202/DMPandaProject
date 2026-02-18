import React, { useState, useRef, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './sidebar';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Sun, Moon, X, ChevronRight, LogOut, Settings, User } from 'lucide-react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { ThemeContext } from '../../contexts/ThemeContext';
import DashboardLoading from '../../components/ui/DashboardLoading';
import { useLoading } from '../../contexts/LoadingContext';
import { cn } from '../../lib/utils';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { currentView, setCurrentView, isLoadingAccounts, isInitialLoadComplete } = useDashboard();
  const { logout, user, hasPassword, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isAppLoading } = useLoading();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
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

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
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
                <span className="brand-mark text-[26px] sm:text-[28px] font-semibold text-foreground -translate-x-1 inline-block">
                  DM Panda
                </span>
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
        <Sidebar
          isCollapsed={!isSidebarOpen}
          onItemClick={() => {
            if (window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="ig-topline sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-card border-b border-border shadow-sm">
          {/* Left Side - Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              data-sidebar-toggle
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors"
            >
              <Menu size={20} />
            </button>
            
            {/* Breadcrumb - Instagram themed */}
            <nav className="flex items-center text-sm font-medium min-w-0">
              <button
                onClick={() => setCurrentView('Dashboard')}
                className={cn(
                  "transition-colors duration-200 hover:text-primary",
                  currentView === 'Dashboard' 
                    ? "ig-gradient-text font-semibold" 
                    : "text-muted-foreground"
                )}
              >
                Dashboard
              </button>
              {currentView !== 'Dashboard' && (
                <>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mx-2 flex-shrink-0" />
                  <span className="ig-gradient-text font-semibold truncate">
                    {currentView}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right Side - Profile Menu */}
          <div ref={profileMenuRef} className="relative flex items-center">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
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
              "ig-topline absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-lg overflow-hidden z-50 transition-all duration-200 origin-top-right",
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
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-5">
          <div className="animate-fadeIn relative min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
