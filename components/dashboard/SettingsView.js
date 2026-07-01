'use client';

import { useState, useEffect } from 'react';

export default function SettingsView() {
  const [settings, setSettings] = useState({
    portfolioName: 'My Real Estate Portfolio',
    defaultZoom: 4,
    theme: 'dark',
    notifications: true,
    currency: 'USD',
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const saved = localStorage.getItem('settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  function handleChange(key, value) {
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem('settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleExport() {
    const allData = {
      settings,
      deals: localStorage.getItem('deals'),
      activeView: localStorage.getItem('activeView'),
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crest-backup-${Date.now()}.json`;
    a.click();
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result);
        if (data.settings) {
          setSettings(data.settings);
          localStorage.setItem('settings', JSON.stringify(data.settings));
        }
        if (data.deals) {
          localStorage.setItem('deals', data.deals);
        }
        alert('Backup restored successfully!');
      } catch (error) {
        alert('Failed to import backup: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  function handleClearAllData() {
    if (!confirm('Delete all local data? This cannot be undone.')) return;
    localStorage.clear();
    setSettings({
      portfolioName: 'My Real Estate Portfolio',
      defaultZoom: 4,
      theme: 'dark',
      notifications: true,
      currency: 'USD',
    });
    alert('All data cleared.');
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'display', label: 'Display' },
    { id: 'data', label: 'Data & Backup' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-500">Configure your CREST experience</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 border-b border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-indigo-600'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Portfolio Name</label>
            <input
              type="text"
              value={settings.portfolioName}
              onChange={(e) => handleChange('portfolioName', e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-indigo-600 outline-none transition-colors"
              placeholder="My Real Estate Portfolio"
            />
            <p className="text-xs text-gray-500 mt-1">Give your portfolio a custom name</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-indigo-600 outline-none transition-colors"
            >
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="GBP">British Pound (GBP)</option>
              <option value="CAD">Canadian Dollar (CAD)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Display currency for prices and values</p>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleChange('notifications', e.target.checked)}
                className="w-4 h-4 bg-gray-900 border border-gray-800 rounded cursor-pointer"
              />
              <span className="text-sm font-semibold text-white">Enable Notifications</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">Get alerts for important events</p>
          </div>
        </div>
      )}

      {/* Display Settings */}
      {activeTab === 'display' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Default Map Zoom</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="18"
                value={settings.defaultZoom}
                onChange={(e) => handleChange('defaultZoom', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-white font-mono font-semibold w-8">{settings.defaultZoom}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Zoom level for initial map view (1-18)</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:border-indigo-600 outline-none transition-colors"
            >
              <option value="dark">Dark (Default)</option>
              <option value="light">Light</option>
              <option value="auto">Auto (System)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Choose your preferred theme</p>
          </div>
        </div>
      )}

      {/* Data & Backup */}
      {activeTab === 'data' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Backup & Restore</h3>
            <p className="text-sm text-gray-400 mb-4">
              Export your settings and deals to a JSON file, or restore from a previous backup.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleExport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                📥 Export Backup
              </button>
              <label className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
                📤 Import Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-red-400 mb-4">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Permanently delete all local data. This cannot be undone.
            </p>
            <button
              onClick={handleClearAllData}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              🗑 Clear All Data
            </button>
          </div>
        </div>
      )}

      {/* About */}
      {activeTab === 'about' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">About CREST</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <p>
                <span className="text-white font-semibold">CREST</span> is a commercial real estate portfolio management and research platform.
              </p>
              <p>
                Manage your markets, assets, and comparable sales with an intelligent AI assistant (Butte) powered by Claude.
              </p>
              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-800">
                <strong>Version:</strong> 1.0.0<br />
                <strong>Last Updated:</strong> June 2026<br />
                <strong>Built with:</strong> Next.js, React, Tailwind CSS, Claude AI
              </p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Storage Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Settings:</span>
                <span className="text-white font-mono">{Math.round(JSON.stringify(settings).length / 1024 * 100) / 100} KB</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Deals:</span>
                <span className="text-white font-mono">
                  {Math.round((localStorage.getItem('deals')?.length || 0) / 1024 * 100) / 100} KB
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      {(activeTab === 'general' || activeTab === 'display') && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={handleSave}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {saved ? '✓ Saved' : '💾 Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
