'use client';

import './globals.css';
import TopBar from '@/components/TopBar';
import { ChatProvider } from '@/lib/chat/ChatContext';
import { AppViewProvider } from '@/lib/appView/AppViewContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Geist+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-950 h-screen flex flex-col">
        <ChatProvider>
          <AppViewProvider>
            <TopBar />
            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          </AppViewProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
