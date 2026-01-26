import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col md:flex-row items-center">
        <img src="/images/confused_panda.png" alt="Confused Panda" className="w-96 h-96 mb-8 md:mb-0 md:mr-8" />
        <div className="text-center md:text-left">
          <h1 className="text-6xl font-bold mb-4">
            <span style={{ color: '#405DE6' }}>4</span>
            <span style={{ color: '#E1306C' }}>0</span>
            <span style={{ color: '#405DE6' }}>4</span>
          </h1>
          <p className="text-2xl text-gray-600 dark:text-gray-400 mb-2">
            Oops! Looks like you've taken a wrong turn.
          </p>
          <p className="text-xl text-gray-500 dark:text-gray-500 mb-8">
            Even our panda gets confused sometimes.
          </p>
          <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Go back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;