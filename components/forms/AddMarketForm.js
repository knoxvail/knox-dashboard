'use client';

import { useEffect, useRef, useState } from 'react';
import { addMarket, updateMarket, loadMarkets } from '@/lib/store/marketStore';

export default function AddMarketForm({ market = null, assetName = '', prefilledLocation = null, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: assetName || '',
    address: prefilledLocation?.address || '',
    lat: prefilledLocation?.lat || null,
    lng: prefilledLocation?.lng || null,
    asset_class: 'multifamily',
    status: 'scouting',
    market_id: '',
    notes: '',
    ...market,
  });
  const [syncing, setSyncing] = useState(false);
  const [markets, setMarkets] = useState([]);
  const [showNewMarketModal, setShowNewMarketModal] = useState(false);
  const [newMarketName, setNewMarketName] = useState('');
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      const marketsData = await loadMarkets();
      setMarkets(marketsData);
    };
    loadData();
  }, []);

  async function handleCreateMarket() {
    if (!newMarketName.trim()) {
      alert('Please enter a market name');
      return;
    }

    const newMarket = await addMarket({
      name: newMarketName,
      address: '',
      lat: prefilledLocation?.lat || 0,
      lng: prefilledLocation?.lng || 0,
      asset_class: 'multifamily',
      status: 'scouting',
      notes: '',
    });

    setMarkets([...markets, newMarket]);
    setFormData(prev => ({ ...prev, market_id: newMarket.id }));
    setNewMarketName('');
    setShowNewMarketModal(false);
  }

  useEffect(() => {
    if (!inputRef.current) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) {
          setFormData(prev => ({
            ...prev,
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          }));
        }
      });
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name || !formData.address || !formData.lat || !formData.lng) {
      alert('Please fill in all required fields');
      return;
    }

    setSyncing(true);
    try {
      let savedMarket;
      if (market) {
        savedMarket = await updateMarket(market.id, formData);
      } else {
        savedMarket = await addMarket(formData);
      }

      // Sync to Notion via API route
      try {
        const notionRes = await fetch('/api/notion/sync-market', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savedMarket),
        });
        if (!notionRes.ok) {
          console.error('Failed to sync to Notion:', await notionRes.text());
        }
      } catch (error) {
        console.error('Failed to sync to Notion:', error);
      }

      setSyncing(false);
      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error('Failed to save market:', error);
      setSyncing(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-96 p-6 animate-scale-in">
          <h2 className="text-lg font-semibold mb-5 text-white">
            {market ? 'Edit Asset' : 'Add Asset'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address *
              </label>
              <input
                ref={inputRef}
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, address: e.target.value }))
                }
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                placeholder="Search address..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Asset Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                placeholder="e.g., Austin CBD"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Market
              </label>
              <select
                value={formData.market_id}
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    setShowNewMarketModal(true);
                  } else {
                    setFormData(prev => ({ ...prev, market_id: e.target.value }));
                  }
                }}
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
              >
                <option value="">Select a market...</option>
                {markets.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                <option value="new">+ Add New Market</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Asset Class
                </label>
                <select
                  value={formData.asset_class}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, asset_class: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                >
                  <option value="multifamily">Multifamily</option>
                  <option value="mixed-use">Mixed-Use</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                >
                  <option value="scouting">Scouting</option>
                  <option value="active">Active</option>
                  <option value="passed">Passed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                rows="3"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={syncing}
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
              >
                {syncing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showNewMarketModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowNewMarketModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-96 p-6 animate-scale-in">
              <h2 className="text-lg font-semibold mb-5 text-white">Create New Market</h2>
              <input
                type="text"
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                placeholder="e.g., Austin CBD, Tulsa Suburbs"
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 mb-6 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMarketName.trim()) {
                    handleCreateMarket();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewMarketModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMarket}
                  disabled={!newMarketName.trim()}
                  className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
