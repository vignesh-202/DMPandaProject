import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Navbar: React.FC = () => {
  const { isAuthenticated, authHint, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent body scroll when menu open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const renderAuthButton = (className: string) => {
    const shouldShowDashboard = isAuthenticated || authHint;

    if (isLoading && !shouldShowDashboard) {
      return (
        <div className={`${className} flex items-center justify-center gap-2 opacity-80 cursor-wait min-w-[120px]`}>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      );
    }
    if (shouldShowDashboard) {
      return <Link to="/dashboard" className={className}>Dashboard</Link>;
    }
    return <Link to="/login" className={className}>Login</Link>;
  };

  const navLinks = [
    { to: '/features', label: 'Features' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/about', label: 'About Us' },
    { to: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
        scrolled
          ? 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl shadow-lg shadow-black/[0.04] dark:shadow-black/[0.2]'
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group relative isolate p-1 -ml-1">
            {/* Creative gradient aura for logo visibility in dark mode */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#405DE6]/40 via-[#833AB4]/40 to-[#FCAF45]/40 rounded-full blur-xl opacity-0 dark:opacity-[0.85] group-hover:dark:opacity-100 transition-opacity duration-500 -z-10" />
            <div className="absolute inset-0.5 bg-white/40 rounded-full blur-md opacity-0 dark:opacity-100 -z-10" />

            <img
              src="/images/logo.png"
              alt="DM Panda Logo"
              className="h-10 sm:h-12 transition-transform duration-300 group-hover:scale-105 relative z-10 dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.65)]"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group relative"
              >
                <span
                  className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    isActive(link.to)
                      ? 'bg-gradient-to-r from-[#405DE6]/12 via-[#833AB4]/12 to-[#FCAF45]/12 dark:from-[#405DE6]/20 dark:via-[#833AB4]/20 dark:to-[#FCAF45]/20 shadow-[inset_0_0_0_1px_rgba(131,58,180,0.12)]'
                      : 'bg-gradient-to-r from-[#405DE6]/0 via-[#833AB4]/0 to-[#FCAF45]/0 group-hover:from-[#405DE6]/8 group-hover:via-[#833AB4]/10 group-hover:to-[#FCAF45]/8 dark:group-hover:from-[#405DE6]/14 dark:group-hover:via-[#833AB4]/16 dark:group-hover:to-[#FCAF45]/14'
                  }`}
                />
                <span
                  className={`absolute inset-x-3 bottom-[5px] h-px origin-left rounded-full transition-all duration-300 ${
                    isActive(link.to)
                      ? 'scale-100 bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FCAF45]'
                      : 'scale-0 group-hover:scale-100 bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FCAF45]'
                  }`}
                />
                <span
                  className={`relative block px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive(link.to)
                      ? 'text-[#833AB4] dark:text-purple-300'
                      : 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <div className="ml-3">
              {renderAuthButton(
                "bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-[#833AB4]/20 font-semibold text-sm transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Toggle menu"
          >
            <div className="w-5 flex flex-col gap-[5px]">
              <span className={`block h-[2px] bg-current rounded-full transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block h-[2px] bg-current rounded-full transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-0' : ''}`} />
              <span className={`block h-[2px] bg-current rounded-full transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Mobile slide-out menu */}
      <div
        ref={menuRef}
        className={`md:hidden fixed top-0 right-0 h-full w-[280px] max-w-[85vw] bg-white dark:bg-neutral-900 shadow-2xl z-50 transition-transform duration-300 ease-out ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <div className="relative isolate p-1 -ml-1">
            <div className="absolute inset-0 bg-gradient-to-r from-[#405DE6]/40 via-[#833AB4]/40 to-[#FCAF45]/40 rounded-full blur-lg opacity-0 dark:opacity-[0.85] -z-10" />
            <div className="absolute inset-0.5 bg-white/40 rounded-full blur-md opacity-0 dark:opacity-100 -z-10" />
            <img src="/images/logo.png" alt="DM Panda" className="h-8 relative z-10 dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.65)]" />
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-4 pb-6 space-y-1">
          {navLinks.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block text-center py-3 text-base font-semibold rounded-xl transition-all duration-200 ${
                isActive(link.to)
                  ? 'text-[#833AB4] dark:text-purple-300 bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 dark:from-[#405DE6]/18 dark:via-[#833AB4]/18 dark:to-[#FCAF45]/18 shadow-[inset_0_0_0_1px_rgba(131,58,180,0.12)]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-[#405DE6]/6 hover:via-[#833AB4]/8 hover:to-[#FCAF45]/6 dark:hover:from-[#405DE6]/12 dark:hover:via-[#833AB4]/14 dark:hover:to-[#FCAF45]/12'
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mx-4 h-px bg-gray-200 dark:bg-white/10" />

        <div className="px-4 pt-4 space-y-1">
          <Link to="/privacy" className="block text-center py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="block text-center py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-colors">Terms & Conditions</Link>
          <Link to="/disclaimer" className="block text-center py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-colors">Disclaimer</Link>
        </div>

        <div className="px-4 pt-6">
          {renderAuthButton(
            "block text-center py-3 text-base font-semibold text-white bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] rounded-xl shadow-lg shadow-[#833AB4]/20"
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
