import React from 'react';

interface CurrencyToggleProps {
  currency: 'INR' | 'USD';
  onToggle: () => void;
}

const CurrencyToggle: React.FC<CurrencyToggleProps> = ({ currency, onToggle }) => {
  return (
    <div className="flex justify-center items-center">
      <span className={`text-lg font-medium ${currency === 'INR' ? 'text-black' : 'text-gray-500'}`}>INR</span>
      <label className="relative inline-block w-14 h-8 mx-4">
        <input type="checkbox" checked={currency === 'USD'} onChange={onToggle} className="opacity-0 w-0 h-0" />
        <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-200 rounded-full transition-colors duration-300 ease-in-out"></span>
        <span className={`absolute cursor-pointer top-1 left-1 w-6 h-6 bg-black rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${currency === 'USD' ? 'translate-x-6' : ''}`}></span>
      </label>
      <span className={`text-lg font-medium ${currency === 'USD' ? 'text-black' : 'text-gray-500'}`}>USD</span>
    </div>
  );
};

export default CurrencyToggle;