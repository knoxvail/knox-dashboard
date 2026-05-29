'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getMarketById, updateMarket, loadMarkets } from '@/lib/store/marketStore';

const STATUS_LABELS = {
  scouting: 'Scouting',
  active: 'Active',
  passed: 'Passed',
  closed: 'Closed',
};

const ASSET_CLASS_LABELS = {
  multifamily: 'Multifamily',
  'mixed-use': 'Mixed-Use',
  both: 'Both',
};

function EditableField({ label, value, onChange, onSave, type = 'text' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-gray-950 rounded border border-gray-800 p-4 card-hover cursor-pointer">
        <p className="text-xs text-gray-500 font-mono uppercase mb-2">{label}</p>
        {type === 'textarea' ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-gray-900/50 border-b-2 border-gray-500 text-lg text-gray-100 rounded px-2 py-1 outline-none"
            rows={3}
          />
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-gray-900/50 border-b-2 border-gray-500 text-lg text-gray-100 rounded px-2 py-1 outline-none"
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="bg-gray-950 rounded border border-gray-800 p-4 card-hover cursor-pointer transition-all duration-200 hover:border-gray-700"
    >
      <p className="text-xs text-gray-500 font-mono uppercase mb-1">{label}</p>
      <p className="text-lg text-gray-100">{value}</p>
    </div>
  );
}

export default function MarketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [market, setMarket] = useState(null);
  const [assets, setAssets] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const data = await getMarketById(params.id);
      setMarket(data);

      // Load assets for this region
      if (data && !data.market_id) {
        // This is a region, load its assets
        const allMarkets = await loadMarkets();
        const regionAssets = allMarkets.filter(m => m.market_id === data.id);
        setAssets(regionAssets);
      }
    };
    loadData();
  }, [params.id]);

  // Initialize map
  useEffect(() => {
    if (!market || !mapRef || mapInstance) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => {
      const map = new google.maps.Map(mapRef, {
        zoom: 10,
        center: { lat: market.lat || 35.0078, lng: market.lng || -97.0929 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      // Add markers for all assets in this region
      assets.forEach(asset => {
        if (asset.lat && asset.lng) {
          new google.maps.Marker({
            position: { lat: asset.lat, lng: asset.lng },
            map: map,
            title: asset.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#6366f1',
              fillOpacity: 0.8,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
        }
      });

      setMapInstance(map);
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [market, assets, mapRef]);

  const handleSave = async (field, value) => {
    if (market) {
      const updated = { ...market, [field]: value };
      await updateMarket(market.id, { [field]: value });
      setMarket(updated);
    }
  };

  if (!market) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Region not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-800 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium"
        >
          ← Back
        </button>
        <h1 className="text-4xl font-bold text-white">{market.name}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-3 gap-6 h-full">
          {/* Map */}
          <div className="col-span-2 p-6">
            <div
              ref={setMapRef}
              className="w-full h-full rounded-2xl border border-gray-800 shadow-lg"
            />
          </div>

          {/* Sidebar with Region Details and Assets */}
          <div className="p-6 bg-gray-900/50 border-l border-gray-800 overflow-y-auto">
            {/* Region Info */}
            <div className="mb-6 pb-6 border-b border-gray-800">
              <p className="text-xs text-gray-500 font-medium uppercase mb-2">Region Coordinates</p>
              <p className="text-sm font-mono text-gray-300 mb-4">
                {market.lat?.toFixed(4)}, {market.lng?.toFixed(4)}
              </p>

              <p className="text-xs text-gray-500 font-medium uppercase mb-2">Total Properties</p>
              <p className="text-lg font-mono text-gray-100 font-semibold">{assets.length}</p>
            </div>

            {/* Assets List */}
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase mb-4">Properties</p>
              {assets.length === 0 ? (
                <p className="text-sm text-gray-400">No properties in this region yet.</p>
              ) : (
                <div className="space-y-2">
                  {assets.map(asset => (
                    <div
                      key={asset.id}
                      className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer list-item"
                    >
                      <p className="text-sm text-gray-200 font-medium">{asset.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{asset.address}</p>
                      <div className={`badge badge-${asset.status} mt-2`}>
                        {STATUS_LABELS[asset.status]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
