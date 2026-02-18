import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Navbar: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const renderAuthButton = (className: string) => {
    if (isLoading) {
      return (
        <div className={`${className} flex items-center justify-center gap-2 opacity-80 cursor-wait min-w-[120px]`}>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      );
    }

    if (isAuthenticated) {
      return <Link to="/dashboard" className={className}>Dashboard</Link>;
    }

    return <Link to="/login" className={className}>Login</Link>;
  };

  return (
    <nav className="bg-white shadow-md md:static sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center md:pl-24">
            <img src="/images/logo.png" alt="DM Panda Logo" className="h-12 md:h-16" />
          </Link>
          <div className="hidden md:flex items-center space-x-8 pr-24 font-sans">
            <Link to="/features" className="text-gray-800 hover:text-[#833AB4] font-bold text-lg relative after:absolute after:bg-gradient-to-r after:from-[#833AB4] after:to-[#405DE6] after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-all duration-300">Features</Link>
            <Link to="/pricing" className="text-gray-800 hover:text-[#833AB4] font-bold text-lg relative after:absolute after:bg-gradient-to-r after:from-[#833AB4] after:to-[#405DE6] after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-all duration-300">Pricing</Link>
            <Link to="/affiliate" className="text-gray-800 hover:text-[#833AB4] font-bold text-lg relative after:absolute after:bg-gradient-to-r after:from-[#833AB4] after:to-[#405DE6] after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-all duration-300">Affiliate</Link>
            <Link to="/contact" className="text-gray-800 hover:text-[#833AB4] font-bold text-lg relative after:absolute after:bg-gradient-to-r after:from-[#833AB4] after:to-[#405DE6] after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-all duration-300">Contact</Link>
            {renderAuthButton("bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-[#833AB4]/25 font-bold text-lg transition-all duration-300 hover:scale-105")}
          </div>
          <div className="md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 hover:text-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div
        ref={menuRef}
        className={`md:hidden fixed top-0 right-0 h-full bg-white shadow-xl z-50 transition-transform transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          } w-72 py-4`}
      >
        <div className="flex justify-end px-4 mb-4">
          <button onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-[#833AB4] transition-colors p-2 rounded-xl hover:bg-[#833AB4]/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <Link to="/features" className="block text-center py-3 mx-4 text-lg font-bold text-gray-800 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Features</Link>
        <Link to="/pricing" className="block text-center py-3 mx-4 text-lg font-bold text-gray-800 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Pricing</Link>
        <Link to="/affiliate" className="block text-center py-3 mx-4 text-lg font-bold text-gray-800 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Affiliate</Link>
        <Link to="/contact" className="block text-center py-3 mx-4 text-lg font-bold text-gray-800 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Contact</Link>
        <div className="my-4 mx-4 h-px bg-gray-200"></div>
        <Link to="/privacy" className="block text-center py-2.5 mx-4 text-base font-medium text-gray-600 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Privacy Policy</Link>
        <Link to="/terms" className="block text-center py-2.5 mx-4 text-base font-medium text-gray-600 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Terms & Conditions</Link>
        <Link to="/disclaimer" className="block text-center py-2.5 mx-4 text-base font-medium text-gray-600 hover:text-[#833AB4] hover:bg-[#833AB4]/10 rounded-xl transition-all duration-200">Disclaimer</Link>
        <div className="my-4 mx-4">
          {renderAuthButton("block text-center py-3 text-lg font-bold text-white bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] rounded-xl shadow-lg shadow-[#833AB4]/20")}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
