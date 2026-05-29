'use client';

import './globals.css';
import { useState, useRef, useEffect } from 'react';
import GlobalSearch from '@/components/GlobalSearch';

export default function RootLayout({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleKeyPress(e) {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target;
      if (target.matches('input, textarea, [contenteditable="true"]')) {
        return;
      }

      // Start search on any printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
        // The character will be typed after focus
      }

      // Cmd+K or Ctrl+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // ESC to blur search
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-950">
        <div className="flex h-screen flex-col">
          {/* Top Search Bar */}
          <div className="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-center px-4">
            <div className="w-full max-w-xl">
              <GlobalSearch ref={searchInputRef} />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            <nav className="w-48 bg-gray-950 border-r border-gray-800 p-4 overflow-y-auto">
              <h1 className="text-lg font-bold mb-6 text-white">CRE Research</h1>
              <ul className="space-y-1 text-sm">
                <li><a href="/" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white transition-colors duration-200 animate-fade-in">Dashboard</a></li>
                <li><a href="/watchlist" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white transition-colors duration-200 animate-fade-in">⭐ Watchlist</a></li>
                <li><a href="/markets" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white transition-colors duration-200 animate-fade-in">Markets</a></li>
                <li><a href="/comps" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white transition-colors duration-200 animate-fade-in">Comps</a></li>
                <li><a href="/deals" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white transition-colors duration-200 animate-fade-in">Deals</a></li>
                <li className="pt-4 border-t border-gray-800"><a href="/settings" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white transition-colors duration-200 animate-fade-in">⚙️ Settings</a></li>
              </ul>
            </nav>
            <main className="flex-1 overflow-auto bg-gray-950 animate-fade-in">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
