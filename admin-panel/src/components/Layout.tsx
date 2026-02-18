import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    Users,
    LayoutDashboard,
    Settings,
    LogOut,
    ShieldCheck,
    CreditCard,
    Instagram,
    Sun,
    Moon
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Layout: React.FC = () => {
    const { logout, user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/users', icon: Users, label: 'Users' },
        { to: '/campaigns', icon: CreditCard, label: 'Campaigns' },
        { to: '/instagram', icon: Instagram, label: 'Instagram' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-gray-100 transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-72 bg-white dark:bg-[#0A0A0A] border-r border-gray-200 dark:border-neutral-800 flex flex-col transition-colors duration-300 z-30">
                <div className="p-8 pb-6 flex items-center space-x-3">
                    <div className="bg-black dark:bg-white p-2.5 rounded-xl shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
                        <ShieldCheck className="w-6 h-6 text-white dark:text-black" />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-gray-900 dark:text-white text-xl tracking-tight">DMPanda</h1>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase">Admin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => cn(
                                "flex items-center space-x-3 px-4 py-3.5 rounded-[14px] transition-all duration-300 group",
                                isActive
                                    ? "bg-black text-white dark:bg-white dark:text-black shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] dark:shadow-[0_10px_20px_-10px_rgba(255,255,255,0.1)] translate-x-1"
                                    : "text-gray-500 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800/50 hover:text-black dark:hover:text-white"
                            )}
                        >
                            <item.icon className={cn(
                                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                                // isActive && "animate-pulse"
                            )} />
                            <span className="font-semibold text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-6 border-t border-gray-100 dark:border-neutral-800 space-y-6 bg-gray-50/50 dark:bg-neutral-900/20">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl hover:border-gray-300 dark:hover:border-neutral-600 transition-all active:scale-95 shadow-sm"
                    >
                        <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                        {theme === 'light' ? <Sun className="w-4 h-4 text-orange-500" /> : <Moon className="w-4 h-4 text-blue-400" />}
                    </button>

                    <div className="flex items-center space-x-3 px-2">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
                            <div className="relative w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-extrabold text-sm border-2 border-white dark:border-neutral-900 shadow-md">
                                {user?.name?.charAt(0) || 'A'}
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate tracking-tight">{user?.name || 'Administrator'}</p>
                            <p className="text-[10px] font-medium text-gray-500 dark:text-neutral-500 truncate uppercase tracking-widest">Active Now</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-200"
                            title="Sign Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
                <header className="sticky top-0 z-20 h-16 bg-gray-50/80 dark:bg-[#050505]/80 backdrop-blur-xl border-b border-transparent px-8 flex items-center justify-between pointer-events-none">
                    {/* Header could have search/notifications later */}
                </header>
                <div className="px-8 pb-12 max-w-[1400px] mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
