'use client';

import { useEffect, useRef, useState } from 'react';
import MarketDrawer from './MarketDrawer';
import AddMarketForm from '../forms/AddMarketForm';

const STATUS_COLORS = {
  scouting: '#3b82f6',
  active: '#eab308',
  passed: '#ef4444',
  closed: '#22c55e',
};

export default function MapView({ markets }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [clickedLocation, setClickedLocation] = useState(null);
  const [assetName, setAssetName] = useState('');

  useEffect(() => {
    if (!mapRef.current) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        zoom: 4,
        center: { lat: 37.0902, lng: -95.7129 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Add click listener to create new asset
      mapInstance.current.addListener('click', async (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Try to reverse geocode
        const geocoder = new google.maps.Geocoder();
        try {
          const results = await geocoder.geocode({ location: { lat, lng } });
          const address = results[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setClickedLocation({ lat, lng, address });
        } catch (error) {
          console.error('Geocoding error:', error);
          setClickedLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        }

        setAssetName('');
        setShowNameInput(true);
      });

      // Render markers
      renderMarkers();
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    renderMarkers();
  }, [markets]);

  function renderMarkers() {
    if (!mapInstance.current) return;

    Object.values(markersRef.current).forEach(marker => marker.setMap(null));
    markersRef.current = {};

    markets.forEach(market => {
      if (!market.lat || !market.lng) return;

      const marker = new google.maps.Marker({
        position: { lat: market.lat, lng: market.lng },
        map: mapInstance.current,
        title: market.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: STATUS_COLORS[market.status] || '#808080',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('mouseover', () => {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: STATUS_COLORS[market.status] || '#808080',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        });
      });

      marker.addListener('mouseout', () => {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: STATUS_COLORS[market.status] || '#808080',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        });
      });

      marker.addListener('click', () => {
        setSelectedMarket(market);
      });

      markersRef.current[market.id] = marker;
    });
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      <div className="absolute top-4 left-4 bg-gray-950 border border-gray-800 rounded shadow-lg p-3 text-sm">
        <p className="font-mono text-gray-400">Click map to add location</p>
      </div>

      <div className="absolute bottom-4 right-4 bg-gray-950 border border-gray-800 rounded shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.scouting }} />
          <span className="font-mono text-gray-400">Scouting</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.active }} />
          <span className="font-mono text-gray-400">Active</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.passed }} />
          <span className="font-mono text-gray-400">Passed</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.closed }} />
          <span className="font-mono text-gray-400">Closed</span>
        </div>
      </div>

      {selectedMarket && (
        <MarketDrawer market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}

      {showNameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center" onClick={() => setShowNameInput(false)}>
          <div className="bg-gray-950 border border-gray-800 rounded shadow-lg w-96 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-white">Name this Asset</h2>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g., Downtown Tulsa Apt Complex"
              className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && assetName.trim()) {
                  setShowNameInput(false);
                  setShowAddForm(true);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNameInput(false)}
                className="flex-1 px-4 py-2 border border-gray-700 bg-gray-900 text-gray-300 rounded text-sm font-mono hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (assetName.trim()) {
                    setShowNameInput(false);
                    setShowAddForm(true);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700 disabled:opacity-50"
                disabled={!assetName.trim()}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddMarketForm
          assetName={assetName}
          prefilledLocation={clickedLocation}
          onClose={() => {
            setShowAddForm(false);
            setClickedLocation(null);
            setAssetName('');
          }}
          onSuccess={() => {
            setShowAddForm(false);
            setClickedLocation(null);
            setAssetName('');
          }}
        />
      )}
    </div>
  );
}
