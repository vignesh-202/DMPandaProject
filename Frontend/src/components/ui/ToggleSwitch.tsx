import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ToggleSwitchProps {
  isChecked: boolean;
  onChange: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isChecked, onChange }) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={isChecked} onChange={onChange} className="sr-only peer" />
      <div className="w-14 h-8 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-gray-900 flex items-center transition-colors duration-300 ease-in-out">
        <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-in-out ${isChecked ? 'translate-x-7' : 'translate-x-1'}`}>
          {isChecked ? <Moon size={16} className="text-gray-900 m-1" /> : <Sun size={16} className="text-yellow-500 m-1" />}
        </div>
      </div>
    </label>
  );
};

export default ToggleSwitch;