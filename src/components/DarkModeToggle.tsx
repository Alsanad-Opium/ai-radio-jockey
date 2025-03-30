import React from 'react';
import { DarkModeSwitch } from 'react-toggle-dark-mode';

interface DarkModeToggleProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ darkMode, toggleDarkMode }) => {
  return (
    <div className="flex items-center">
      <span className="mr-2 text-gray-600 dark:text-gray-300 text-sm">
        {darkMode ? 'Dark' : 'Light'}
      </span>
      <DarkModeSwitch
        checked={darkMode}
        onChange={toggleDarkMode}
        size={24}
        moonColor="#f1c40f"
        sunColor="#f39c12"
      />
    </div>
  );
};

export default DarkModeToggle; 