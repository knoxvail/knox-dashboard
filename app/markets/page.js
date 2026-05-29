'use client';

import { useEffect, useState } from 'react';
import { loadMarkets } from '@/lib/store/marketStore';
import { getAssetsByMarket } from '@/lib/store/assetStore';
import { useRouter } from 'next/navigation';

const STATUS_LABELS = {
  scouting: 'Scouting',
  active: 'Active',
  passed: 'Passed',
  closed: 'Closed',
};

export default function MarketsPage() {
  const router = useRouter();
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    loadAndDisplay();
  }, []);

  function loadAndDisplay() {
    const allMarkets = loadMarkets();

    // Group markets by whether they have a market_id (parent market)
    // If market_id exists, it's an asset. Otherwise, it's a region
    const regionMap = {};

    allMarkets.forEach(market => {
      if (!market.market_id) {
        // This is a region
        regionMap[market.id] = {
          ...market,
          assets: []
        };
      }
    });

    allMarkets.forEach(market => {
      if (market.market_id && regionMap[market.market_id]) {
        // This is an asset belonging to a region
        regionMap[market.market_id].assets.push(market);
      }
    });

    setRegions(Object.values(regionMap));
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Market Regions</h1>

      {regions.length === 0 ? (
        <p className="text-gray-400">No market regions yet. Create one from the map.</p>
      ) : (
        <div className="grid gap-8">
          {regions.map((region, i) => (
            <div
              key={region.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-fade-in card-hover"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Region Header */}
              <div className="mb-6 pb-4 border-b border-gray-800">
                <h2
                  className="text-2xl font-bold text-white cursor-pointer hover:text-gray-200 transition-colors"
                  onClick={() => router.push(`/markets/${region.id}`)}
                >
                  {region.name}
                </h2>
              </div>

              {/* Assets List */}
              {region.assets.length > 0 ? (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 font-medium uppercase mb-4">Properties in Region ({region.assets.length})</p>
                  <div className="space-y-2">
                    {region.assets.map(asset => (
                      <div
                        key={asset.id}
                        className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer list-item"
                        onClick={() => router.push(`/?asset=${asset.id}`)}
                      >
                        <div className="flex-1">
                          <p className="text-sm text-gray-200 font-medium">{asset.name}</p>
                          <p className="text-xs text-gray-400">{asset.address}</p>
                        </div>
                        <div className={`badge badge-${asset.status}`}>
                          {STATUS_LABELS[asset.status]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-gray-800/20 rounded-lg">
                  <p className="text-sm text-gray-400">No properties yet in this region</p>
                </div>
              )}

              {/* Region Details */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase mb-1">Coordinates</p>
                  <p className="text-sm font-mono text-gray-300">{region.lat?.toFixed(4)}, {region.lng?.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase mb-1">Total Assets</p>
                  <p className="text-sm font-mono text-gray-300">{region.assets.length}</p>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => router.push(`/markets/${region.id}`)}
                    className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    View Region
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
