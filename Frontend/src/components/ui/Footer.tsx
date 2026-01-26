import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaPaperPlane } from 'react-icons/fa';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-black">
      <div className="container mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo and About Section */}
          <div className="col-span-1">
            <h3 className="text-3xl font-bold mb-4">DM Panda</h3>
            <p className="text-gray-600 mb-6">
              Automate Your Instagram DMs with Ease.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-600 hover:text-black transition-colors duration-300">
                <FaFacebook size={28} />
              </a>
              <a href="#" className="text-gray-600 hover:text-black transition-colors duration-300">
                <FaTwitter size={28} />
              </a>
              <a href="#" className="text-gray-600 hover:text-black transition-colors duration-300">
                <FaInstagram size={28} />
              </a>
              <a href="#" className="text-gray-600 hover:text-black transition-colors duration-300">
                <FaLinkedin size={28} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h3 className="text-xl font-semibold mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-gray-600 hover:text-black transition-colors duration-300">Home</Link></li>
              <li><Link to="/features" className="text-gray-600 hover:text-black transition-colors duration-300">Features</Link></li>
              <li><Link to="/about" className="text-gray-600 hover:text-black transition-colors duration-300">About Us</Link></li>
              <li><Link to="/pricing" className="text-gray-600 hover:text-black transition-colors duration-300">Pricing</Link></li>
              <li><Link to="/affiliate" className="text-gray-600 hover:text-black transition-colors duration-300">Affiliate Program</Link></li>
              <li><Link to="/contact" className="text-gray-600 hover:text-black transition-colors duration-300">Contact</Link></li>
            </ul>
          </div>

          {/* Legal Section */}
          <div className="col-span-1">
            <h3 className="text-xl font-semibold mb-6">Legal</h3>
            <ul className="space-y-3">
              <li><Link to="/privacy" className="text-gray-600 hover:text-black transition-colors duration-300">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-gray-600 hover:text-black transition-colors duration-300">Terms & Conditions</Link></li>
              <li><Link to="/disclaimer" className="text-gray-600 hover:text-black transition-colors duration-300">Disclaimer</Link></li>
              <li><Link to="/refund-policy" className="text-gray-600 hover:text-black transition-colors duration-300">Refund Policy</Link></li>
              <li><Link to="/delete-account-guide" className="text-gray-600 hover:text-black transition-colors duration-300">Delete Account</Link></li>
            </ul>
          </div>

          {/* Newsletter Subscription */}
          <div className="col-span-1">
            <h3 className="text-xl font-semibold mb-6">Stay Updated</h3>
            <p className="text-gray-600 mb-4">Subscribe to our newsletter to get the latest updates and offers.</p>
            <div className="relative">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-gray-100 text-black rounded-full py-3 px-6 focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-black text-white rounded-full p-2 hover:bg-gray-800 transition-colors duration-300">
                <FaPaperPlane size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-100 py-6">
        <div className="container mx-auto px-8 text-center">
          <p className="text-gray-500">&copy; 2025 DM Panda. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;