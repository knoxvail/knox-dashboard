'use client';

import './globals.css';
import GlobalSearch from '@/components/GlobalSearch';
import { usePathname } from 'next/navigation';

export default function RootLayout({ children }) {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Geist+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-950">
        <div className="flex h-screen flex-col">
          {/* Top Header with Logo and Search */}
          <div className="h-20 bg-gray-950 border-b border-gray-800 flex items-center px-6 gap-6">
            <div className="flex items-center gap-2 shrink-0">
              <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 20h20L12 2Z" />
                <path d="M12 10L6 18h12L12 10Z" />
              </svg>
              <h1 className="text-3xl font-bold text-white tracking-tight">CREST</h1>
            </div>
            <div className="flex-1">
              <GlobalSearch />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            <nav className="w-56 bg-gray-950 border-r border-gray-800 p-6 overflow-y-auto">
              <ul className="space-y-1 text-base">
                <li><a href="/" className={`block px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in font-medium list-item ${isActive('/') ? 'border-l-2 border-indigo-600 bg-gray-900/30 text-white' : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'}`}>Dashboard</a></li>
                <li><a href="/watchlist" className={`block px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in font-medium list-item ${isActive('/watchlist') ? 'border-l-2 border-indigo-600 bg-gray-900/30 text-white' : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'}`}>Watchlist</a></li>
                <li><a href="/markets" className={`block px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in font-medium list-item ${isActive('/markets') ? 'border-l-2 border-indigo-600 bg-gray-900/30 text-white' : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'}`}>Markets</a></li>
                <li><a href="/comps" className={`block px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in font-medium list-item ${isActive('/comps') ? 'border-l-2 border-indigo-600 bg-gray-900/30 text-white' : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'}`}>Comps</a></li>
                <li><a href="/deals" className={`block px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in font-medium list-item ${isActive('/deals') ? 'border-l-2 border-indigo-600 bg-gray-900/30 text-white' : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'}`}>Deals</a></li>
                <li className="pt-3 border-t border-gray-800"><a href="/settings" className={`block px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in font-medium list-item ${isActive('/settings') ? 'border-l-2 border-indigo-600 bg-gray-900/30 text-white' : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'}`}>Settings</a></li>
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
