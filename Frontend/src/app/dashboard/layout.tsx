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
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
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
      if (window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isSidebarOpen) {
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
      if (window.innerWidth < 768) {
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

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Mobile Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-foreground/20 backdrop-blur-sm z-20 md:hidden transition-opacity duration-200",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 h-full flex flex-col transition-all duration-300 ease-out md:relative z-30",
          "bg-sidebar border-r border-sidebar-border",
          isSidebarOpen 
            ? "w-64 translate-x-0" 
            : "w-64 -translate-x-full md:w-[72px] md:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border",
          isSidebarOpen ? "justify-between" : "justify-center"
        )}>
          {isSidebarOpen && (
            <Link to="/" className="transition-opacity hover:opacity-80">
              <img src="/images/logo.png" alt="DM Panda" className="h-[52px] sm:h-[62px] md:h-[62px] w-auto max-h-[62px] object-contain" />
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Sidebar Content */}
        <Sidebar
          isCollapsed={!isSidebarOpen}
          onItemClick={() => {
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-card border-b border-border">
          {/* Left Side - Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              data-sidebar-toggle
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden transition-colors"
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
                    ? "text-primary font-semibold" 
                    : "text-muted-foreground"
                )}
              >
                Dashboard
              </button>
              {currentView !== 'Dashboard' && (
                <>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mx-2 flex-shrink-0" />
                  <span className="text-primary font-semibold truncate">
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
              className="relative p-[2px] rounded-full transition-all duration-300 bg-border hover:bg-muted-foreground/20 group"
            >
              {user ? (
                <img
                  src={`https://cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(user.name)}&width=100&height=100`}
                  alt={user.name}
                  className="w-[30px] h-[30px] sm:w-[36px] sm:h-[36px] rounded-full object-cover border-2 border-card transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="w-[30px] h-[30px] sm:w-[36px] sm:h-[36px] rounded-full bg-muted flex items-center justify-center border-2 border-card">
                  <User className="w-[18px] h-[18px] text-muted-foreground" />
                </div>
              )}
            </button>

            {/* Profile Dropdown - Instagram themed */}
            <div className={cn(
              "absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-lg overflow-hidden z-50 transition-all duration-200 origin-top-right",
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-4">
          <div className="animate-fadeIn relative min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
