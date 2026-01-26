import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth();
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

  return (
    <nav className="bg-white shadow-md md:static sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center md:pl-24">
            <img src="/images/logo.png" alt="DM Panda Logo" className="h-12 md:h-16" />
          </Link>
          <div className="hidden md:flex items-center space-x-8 pr-24 font-sans">
            <Link to="/features" className="text-black hover:text-gray-600 font-bold text-lg relative after:absolute after:bg-black after:bottom-0 after:left-0 after:h-px after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-transform duration-300">Features</Link>
            <Link to="/pricing" className="text-black hover:text-gray-600 font-bold text-lg relative after:absolute after:bg-black after:bottom-0 after:left-0 after:h-px after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-transform duration-300">Pricing</Link>
            <Link to="/affiliate" className="text-black hover:text-gray-600 font-bold text-lg relative after:absolute after:bg-black after:bottom-0 after:left-0 after:h-px after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-transform duration-300">Affiliate</Link>
            <Link to="/contact" className="text-black hover:text-gray-600 font-bold text-lg relative after:absolute after:bg-black after:bottom-0 after:left-0 after:h-px after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:ease-in-out after:duration-300 transform hover:scale-105 transition-transform duration-300">Contact</Link>
            {isAuthenticated ? (
              <Link to="/dashboard" className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 font-bold text-lg">Dashboard</Link>
            ) : (
              <Link to="/login" className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 font-bold text-lg">Login</Link>
            )}
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
        className={`md:hidden fixed top-0 right-0 h-full bg-white shadow-lg z-50 transition-transform transform ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          } w-64 py-4`}
      >
        <div className="flex justify-end px-4">
          <button onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-black">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <Link to="/features" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Features</Link>
        <Link to="/pricing" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Pricing</Link>
        <Link to="/affiliate" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Affiliate</Link>
        <Link to="/contact" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Contact</Link>
        <Link to="/privacy" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Privacy Policy</Link>
        <Link to="/terms" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Terms & Conditions</Link>
        <Link to="/disclaimer" className="block text-center py-2 text-lg font-bold text-black hover:bg-gray-100">Disclaimer</Link>
        {isAuthenticated ? (
          <Link to="/dashboard" className="block text-center py-2 text-lg font-bold text-white bg-black hover:bg-gray-800 mx-4 my-2 rounded-md">Dashboard</Link>
        ) : (
          <Link to="/login" className="block text-center py-2 text-lg font-bold text-white bg-black hover:bg-gray-800 mx-4 my-2 rounded-md">Login</Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
