'use client';

import './globals.css';
import GlobalSearch from '@/components/GlobalSearch';

export default function RootLayout({ children }) {

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Geist+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-950">
        <div className="flex h-screen flex-col">
          {/* Top Search Bar */}
          <div className="h-20 bg-gray-950 border-b border-gray-800 flex items-center justify-center px-6">
            <div className="w-full max-w-2xl">
              <GlobalSearch />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            <nav className="w-56 bg-gray-950 border-r border-gray-800 p-6 overflow-y-auto">
              <div className="mb-8 flex items-center gap-2">
                <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 20h20L12 2Z" />
                  <path d="M12 10L6 18h12L12 10Z" />
                </svg>
                <h1 className="text-2xl font-bold text-white">CREST</h1>
              </div>
              <ul className="space-y-2 text-base font-mono">
                <li><a href="/" className="block px-4 py-3.5 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200 animate-fade-in font-semibold">Dashboard</a></li>
                <li><a href="/watchlist" className="block px-4 py-3.5 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200 animate-fade-in font-semibold">Watchlist ⭐</a></li>
                <li><a href="/markets" className="block px-4 py-3.5 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200 animate-fade-in font-semibold">Markets</a></li>
                <li><a href="/comps" className="block px-4 py-3.5 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200 animate-fade-in font-semibold">Comps</a></li>
                <li><a href="/deals" className="block px-4 py-3.5 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200 animate-fade-in font-semibold">Deals</a></li>
                <li className="pt-4 border-t border-gray-800"><a href="/settings" className="block px-4 py-3.5 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200 animate-fade-in font-semibold">⚙️ Settings</a></li>
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
