import './globals.css';

export const metadata = {
  title: 'CRE Market Research',
  description: 'Commercial Real Estate Market Research Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-950">
        <div className="flex h-screen">
          <nav className="w-48 bg-gray-950 border-r border-gray-800 p-4 overflow-y-auto">
            <h1 className="text-lg font-bold mb-6 text-white">CRE Research</h1>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white">Dashboard</a></li>
              <li><a href="/markets" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white">Markets</a></li>
              <li><a href="/comps" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white">Comps</a></li>
              <li><a href="/deals" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white">Deals</a></li>
              <li><a href="/settings" className="block px-3 py-2 rounded hover:bg-gray-900 text-gray-300 hover:text-white">Settings</a></li>
            </ul>
          </nav>
          <main className="flex-1 overflow-auto bg-gray-950">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
