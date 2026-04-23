import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-neutral-950 transition-colors duration-500 p-4">
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
        <img src="/images/confused_panda.png" alt="Confused Panda" className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96" />
        <div className="text-center md:text-left">
          <h1 className="text-5xl sm:text-6xl font-bold mb-4">
            <span className="text-[#405DE6]">4</span>
            <span className="text-[#E1306C]">0</span>
            <span className="text-[#405DE6]">4</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-2">
            Oops! Looks like you've taken a wrong turn.
          </p>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-500 mb-8">
            Even our panda gets confused sometimes.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all active:scale-[0.98]"
          >
            Go back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;