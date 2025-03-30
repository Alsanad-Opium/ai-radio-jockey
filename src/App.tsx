import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import RadioPlayer from './components/RadioPlayer';
import DarkModeToggle from './components/DarkModeToggle';
import './App.css';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
            AI Radio DJ
          </h1>
          <DarkModeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        </header>
        
        <main>
          <RadioPlayer />
        </main>
        
        <footer className="mt-12 text-center text-gray-600 dark:text-gray-400">
          <p>Powered by DeepSeek, Eleven Labs, and Spotify</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
