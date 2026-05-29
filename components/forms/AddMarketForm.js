'use client';

import { useEffect, useRef, useState } from 'react';
import { addMarket, updateMarket } from '@/lib/store/marketStore';

export default function AddMarketForm({ market = null, prefilledLocation = null, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    address: prefilledLocation?.address || '',
    lat: prefilledLocation?.lat || null,
    lng: prefilledLocation?.lng || null,
    asset_class: 'multifamily',
    status: 'scouting',
    notes: '',
    ...market,
  });
  const [syncing, setSyncing] = useState(false);
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

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
        savedMarket = updateMarket(market.id, formData);
      } else {
        savedMarket = addMarket(formData);
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
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-gray-950 border border-gray-800 rounded shadow-lg w-96 p-6">
          <h2 className="text-lg font-bold mb-4 text-white">
            {market ? 'Edit Market' : 'Add Market'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">
                Address *
              </label>
              <input
                ref={inputRef}
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, address: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                placeholder="Search address..."
              />
            </div>

            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">
                Market Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                placeholder="e.g., Austin CBD"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">
                  Asset Class
                </label>
                <select
                  value={formData.asset_class}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, asset_class: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                >
                  <option value="multifamily">Multifamily</option>
                  <option value="mixed-use">Mixed-Use</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                >
                  <option value="scouting">Scouting</option>
                  <option value="active">Active</option>
                  <option value="passed">Passed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                rows="3"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-700 bg-gray-900 text-gray-300 rounded text-sm font-mono hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={syncing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
