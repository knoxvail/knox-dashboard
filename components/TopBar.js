'use client';

import GlobalSearch from '@/components/GlobalSearch';
import { ButteChatDropdown } from '@/components/chat/ButteChatDropdown';
import { useAppView } from '@/lib/appView/AppViewContext';

export default function TopBar() {
  const { view, setView } = useAppView();

  return (
    <div className="h-16 bg-gray-950 border-b border-gray-800 flex items-center px-5 gap-5 justify-between shrink-0">
      <div className="flex items-center gap-4 shrink-0">
        {/* Logo → Settings */}
        <button
          onClick={() => setView('settings')}
          className={`flex items-center gap-2 rounded-lg px-1 transition-colors ${view === 'settings' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
          title="Settings"
        >
          <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 20h20L12 2Z" />
            <path d="M12 10L6 18h12L12 10Z" />
          </svg>
          <h1 className="text-2xl font-bold tracking-tight">CREST</h1>
        </button>

        {/* Map / Database toggle */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView('map')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            ◗ Map
          </button>
          <button
            onClick={() => setView('database')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === 'database' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            ▦ Database
          </button>
        </div>
      </div>

      <div className="flex-1">
        <GlobalSearch />
      </div>

      <div className="shrink-0">
        <ButteChatDropdown />
      </div>
    </div>
  );
}
