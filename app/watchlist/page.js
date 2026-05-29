'use client';

import { useEffect, useState } from 'react';
import { loadAssets, toggleWatched, deleteAsset } from '@/lib/store/assetStore';
import { loadMarkets } from '@/lib/store/marketStore';

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    loadAndDisplay();
  }, []);

  function loadAndDisplay() {
    const allAssets = loadAssets();
    const watched = allAssets.filter(a => a.watched);
    setWatchlist(watched);
    setMarkets(loadMarkets());
  }

  function handleRemove(id) {
    if (confirm('Remove from watchlist?')) {
      toggleWatched(id);
      loadAndDisplay();
    }
  }

  function getMarketName(marketId) {
    return markets.find(m => m.id === marketId)?.name || 'Unknown';
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-white">Asset Watchlist</h1>

      {watchlist.length === 0 ? (
        <p className="text-gray-400">No assets on watchlist. Add some from the Assets page.</p>
      ) : (
        <div className="grid gap-4">
          {watchlist.map(asset => (
            <div
              key={asset.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 hover:shadow-lg transition-all duration-200 group animate-fade-in"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors duration-200">{asset.address}</h3>
                  <p className="text-sm text-gray-400 font-medium mt-1">{getMarketName(asset.market_id)}</p>
                </div>
                <button
                  onClick={() => handleRemove(asset.id)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200"
                >
                  Remove ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                {asset.property_type && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs">Type</p>
                    <p className="text-gray-300 font-medium">{asset.property_type}</p>
                  </div>
                )}
                {asset.units && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs">Units</p>
                    <p className="text-gray-300 font-medium">{asset.units}</p>
                  </div>
                )}
                {asset.asking_price && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs">Asking Price</p>
                    <p className="text-gray-300 font-mono font-semibold">${asset.asking_price.toLocaleString()}</p>
                  </div>
                )}
                {asset.avg_rent && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs">Avg Rent</p>
                    <p className="text-gray-300 font-mono font-semibold">${asset.avg_rent.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {asset.notes && (
                <p className="text-sm text-gray-400 mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                  {asset.notes}
                </p>
              )}

              <p className="text-xs text-gray-600 mt-4 font-mono">
                Added: {new Date(asset.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
