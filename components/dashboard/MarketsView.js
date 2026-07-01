'use client';

import { useState, useEffect } from 'react';
import { loadAssets } from '@/lib/store/assetStore';
import EmptyState from '@/components/EmptyState';

const STATUS_LABELS = {
  scouting: 'Scouting',
  interested: 'Interested',
  active: 'Active',
  passed: 'Passed',
  closed: 'Closed',
};

export default function MarketsView({ markets, onAssetSelect }) {
  const [regions, setRegions] = useState([]);
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAndDisplay();
  }, [markets]);

  const handleEditStart = (marketId, marketName) => {
    setEditingId(marketId);
    setEditingName(marketName);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleEditSave = async (marketId) => {
    if (!editingName.trim()) {
      handleEditCancel();
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/update/market', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: marketId, name: editingName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update market');
      }

      // Update local state
      setRegions(regions.map(r =>
        r.id === marketId ? { ...r, name: editingName } : r
      ));

      handleEditCancel();
    } catch (error) {
      alert('Failed to update market: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMarket = async (marketId, marketName) => {
    if (!confirm(`Delete "${marketName}" and all its properties? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/delete/market', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: marketId }),
      });

      if (!response.ok) throw new Error('Failed to delete market');

      setRegions(regions.filter(r => r.id !== marketId));
    } catch (error) {
      alert('Failed to delete market: ' + error.message);
    }
  };

  async function loadAndDisplay() {
    // Create region map from markets
    const regionMap = {};

    markets.forEach(market => {
      regionMap[market.id] = {
        ...market,
        assets: []
      };
    });

    // Load assets and assign to markets
    const assets = await loadAssets();
    assets.forEach(asset => {
      if (asset.market_id && regionMap[asset.market_id]) {
        regionMap[asset.market_id].assets.push(asset);
      }
    });

    // Sort regions alphabetically and their assets alphabetically
    const sortedRegions = Object.values(regionMap)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(region => ({
        ...region,
        assets: region.assets.sort((a, b) => (a.name || a.address).localeCompare(b.name || b.address))
      }));

    setRegions(sortedRegions);
  }

  // Get selected market
  const selectedMarket = selectedMarketId ? regions.find(r => r.id === selectedMarketId) : null;

  // If viewing market detail, show that instead
  if (selectedMarket) {
    return (
      <div className="p-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedMarketId(null)}
          className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-6"
        >
          <span>←</span>
          <span className="font-mono text-sm">Back to Markets</span>
        </button>

        {/* Market Detail */}
        <div className="max-w-4xl">
          {/* Market Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              {editingId === selectedMarket.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(selectedMarket.id);
                      if (e.key === 'Escape') handleEditCancel();
                    }}
                    className="text-4xl font-bold text-white bg-gray-900 border border-indigo-600 rounded px-3 py-1"
                    autoFocus
                  />
                  <button
                    onClick={() => handleEditSave(selectedMarket.id)}
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    title="Save (Enter)"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    title="Cancel (Esc)"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-4xl font-bold text-white">{selectedMarket.name}</h1>
                  <button
                    onClick={() => handleEditStart(selectedMarket.id, selectedMarket.name)}
                    className="text-gray-400 hover:text-indigo-400 transition-colors p-2"
                    title="Edit market name"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteMarket(selectedMarket.id, selectedMarket.name)}
                    className="text-red-400 hover:text-red-300 transition-colors p-2"
                    title="Delete market"
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-4 text-sm text-gray-400">
              {selectedMarket.asset_class && <span>{selectedMarket.asset_class}</span>}
              {selectedMarket.status && <span>Status: {selectedMarket.status}</span>}
              {selectedMarket.score && <span>Score: {selectedMarket.score.toFixed(1)}</span>}
            </div>
          </div>

          {/* Market Notes */}
          {selectedMarket.notes && (
            <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-300">{selectedMarket.notes}</p>
            </div>
          )}

          {/* Assets in this Market */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Properties in {selectedMarket.name}</h2>
            {selectedMarket.assets.length > 0 ? (
              <div className="space-y-3">
                {selectedMarket.assets.map(asset => (
                  <div
                    key={asset.id}
                    className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-lg font-bold text-white">{asset.name}</p>
                        <p className="text-sm text-gray-400 mt-1">{asset.address}</p>
                      </div>
                      <div className={`badge badge-${asset.status}`}>
                        {STATUS_LABELS[asset.status] || asset.status}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                      {asset.units && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase">Units</p>
                          <p className="text-gray-300">{asset.units}</p>
                        </div>
                      )}
                      {asset.purchase_price && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase">Price</p>
                          <p className="text-gray-300">${(asset.purchase_price / 1000000).toFixed(1)}M</p>
                        </div>
                      )}
                      {asset.cap_rate && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase">Cap Rate</p>
                          <p className="text-gray-300">{(asset.cap_rate * 100).toFixed(2)}%</p>
                        </div>
                      )}
                      {asset.score && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase">Score</p>
                          <p className="text-gray-300">{asset.score.toFixed(1)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-gray-400">No properties in this market yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Market Regions</h1>
        <p className="text-gray-500">{regions.length} market{regions.length !== 1 ? 's' : ''} in your portfolio</p>
      </div>

      {regions.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No market regions yet"
          description="Use the Map tab or Butte's Research Market feature to create your first market region."
        />
      ) : (
        <div className="grid gap-8">
          {regions.map((region, i) => (
            <div
              key={region.id}
              onClick={() => setSelectedMarketId(region.id)}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-fade-in card-hover cursor-pointer transition-all hover:border-indigo-600/50 hover:shadow-lg hover:shadow-indigo-600/10"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Region Header */}
              <div className="mb-6 pb-4 border-b border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  {editingId === region.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(region.id);
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        className="text-2xl font-bold text-white bg-gray-800 border border-indigo-600 rounded px-3 py-1 flex-1"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditSave(region.id)}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
                        title="Save (Enter)"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-sm"
                        title="Cancel (Esc)"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-white hover:text-indigo-400 transition-colors flex-1">
                        {region.name}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStart(region.id, region.name);
                        }}
                        className="text-gray-400 hover:text-indigo-400 transition-colors p-1"
                        title="Edit market name"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMarket(region.id, region.name);
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                        title="Delete market"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
                {region.asset_class && (
                  <p className="text-sm text-gray-400 mt-1">{region.asset_class}</p>
                )}
              </div>

              {/* Assets List */}
              {region.assets.length > 0 ? (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 font-medium uppercase mb-4">
                    Properties in Region ({region.assets.length})
                  </p>
                  <div className="space-y-2">
                    {region.assets.map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => onAssetSelect?.(asset)}
                        className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/70 hover:border-indigo-600/50 transition-all list-item cursor-pointer border border-transparent"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-gray-200 font-medium">{asset.name}</p>
                          <p className="text-xs text-gray-400">{asset.address}</p>
                        </div>
                        <div className={`badge badge-${asset.status}`}>
                          {STATUS_LABELS[asset.status] || asset.status}
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
                  <p className="text-xs text-gray-500 font-medium uppercase mb-1">Status</p>
                  <p className="text-sm font-mono text-gray-300">{region.status || 'scouting'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase mb-1">Total Assets</p>
                  <p className="text-sm font-mono text-gray-300">{region.assets.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium uppercase mb-1">Score</p>
                  <p className="text-sm font-mono text-gray-300">{region.score || '—'}</p>
                </div>
              </div>

              {/* Region Notes */}
              {region.notes && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 font-medium uppercase mb-2">Notes</p>
                  <p className="text-sm text-gray-400">{region.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
