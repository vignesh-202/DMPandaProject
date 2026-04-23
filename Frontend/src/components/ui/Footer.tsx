import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaPaperPlane } from 'react-icons/fa';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 border-t border-gray-100 dark:border-white/[0.06] transition-colors duration-500">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="text-2xl font-bold mb-3">DM Panda</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-5 text-sm leading-relaxed">
              Automate Your Instagram DMs with Ease.
            </p>
            <div className="flex space-x-3">
              {[
                { icon: FaFacebook, href: '#' },
                { icon: FaTwitter, href: '#' },
                { icon: FaInstagram, href: '#' },
                { icon: FaLinkedin, href: '#' },
              ].map(({ icon: Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 hover:bg-gradient-to-br hover:from-[#833AB4] hover:to-[#405DE6] hover:text-white transition-all duration-300 hover:scale-105"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Quick Links</h3>
            <ul className="space-y-2.5">
              {[
                { to: '/', label: 'Home' },
                { to: '/features', label: 'Features' },
                { to: '/about', label: 'About Us' },
                { to: '/pricing', label: 'Pricing' },
                { to: '/contact', label: 'Contact' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Legal</h3>
            <ul className="space-y-2.5">
              {[
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/terms', label: 'Terms & Conditions' },
                { to: '/disclaimer', label: 'Disclaimer' },
                { to: '/refund-policy', label: 'Refund Policy' },
                { to: '/delete-account-guide', label: 'Delete Account' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Stay Updated</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">Subscribe for the latest updates and offers.</p>
            <div className="relative">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-gray-100 rounded-xl py-3 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#833AB4]/40 border border-transparent focus:border-[#833AB4]/30 dark:focus:border-purple-500/30 placeholder-gray-400 dark:placeholder-gray-500 text-sm transition-all duration-200"
              />
              <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gradient-to-r from-[#833AB4] to-[#405DE6] text-white rounded-lg hover:shadow-lg hover:shadow-[#833AB4]/20 transition-all duration-300 hover:scale-105 active:scale-95">
                <FaPaperPlane size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-gray-50 dark:bg-black/30 py-5 border-t border-gray-100 dark:border-white/[0.06]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl text-center">
          <p className="text-gray-500 dark:text-gray-500 text-sm">&copy; 2025 DM Panda. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
