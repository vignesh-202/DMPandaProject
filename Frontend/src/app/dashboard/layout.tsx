import React, { useState, useRef, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './sidebar';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Sun, Moon, X } from 'lucide-react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { ThemeContext } from '../../contexts/ThemeContext';
import DashboardLoading from '../../components/ui/DashboardLoading';
import { useLoading } from '../../contexts/LoadingContext';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { setCurrentView } = useDashboard();
  const { logout, user, hasPassword, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isAppLoading } = useLoading();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

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
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const [isMinimumLoading, setIsMinimumLoading] = useState(true);
  const hasCompletedMinimumLoading = useRef(false);

  useEffect(() => {
    if (!hasCompletedMinimumLoading.current) {
      const timer = setTimeout(() => {
        setIsMinimumLoading(false);
        hasCompletedMinimumLoading.current = true;
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsMinimumLoading(false);
    }
  }, []);

  if (isAuthLoading || isAppLoading || isMinimumLoading) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full shadow-md flex-col transition-all duration-300 md:relative z-30 flex bg-white dark:bg-gray-800 ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'
          }`}
      >
        <div className={`p-4 border-b flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} dark:border-gray-700`}>
          {isSidebarOpen && (
            <Link to="/">
              <img src="/images/logo.png" alt="DM Panda Logo" className="w-32" />
            </Link>
          )}
          <div className={`w-full flex ${isSidebarOpen ? 'justify-end' : 'justify-center'}`}>
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-full text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar isCollapsed={!isSidebarOpen} />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 shadow-md sticky top-0 z-20 bg-white dark:bg-gray-800">
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              data-sidebar-toggle
              className="p-1 rounded-full text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black md:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-bold ml-4 text-black dark:text-white">Dashboard</h1>
          </div>
          <div ref={profileMenuRef} className="flex items-center relative">
            <div className="ml-4">
              <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                {user ? (
                  <img
                    src={`https://cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(user.name)}&width=100&height=100`}
                    alt={user.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <img src="/images/logo.png" alt="User" className="w-10 h-10 rounded-full" />
                )}
              </button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-20 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between px-4 py-2 text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black">
                    <span className="flex items-center">
                      {isDarkMode ? <Moon size={20} className="mr-2" /> : <Sun size={20} className="mr-2" />}
                      Dark Mode
                    </span>
                    <ToggleSwitch isChecked={isDarkMode} onChange={toggleTheme} />
                  </div>
                  <button
                    onClick={() => setCurrentView('Account Settings')}
                    className="w-full text-left block px-4 py-2 text-sm text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left block px-4 py-2 text-sm text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
