'use client';

import { useEffect, useState } from 'react';
import { loadAssets, toggleWatched } from '@/lib/store/assetStore';
import { loadDrawings } from '@/lib/store/drawingStore';
import { getRegionsForPoint } from '@/lib/utils/geo';
import EmptyState from '@/components/EmptyState';

export default function AssetsView({ markets, onAssetSelect }) {
  const [assets, setAssets] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAndDisplay();
    loadDrawings().then(setDrawings);
  }, []);

  async function loadAndDisplay() {
    const allAssets = await loadAssets();
    const sorted = allAssets.sort((a, b) => (a.name || a.address).localeCompare(b.name || b.address));
    setAssets(sorted);
  }

  const handleEditStart = (assetId, assetName) => {
    setEditingId(assetId);
    setEditingName(assetName);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleEditSave = async (assetId) => {
    if (!editingName.trim()) {
      handleEditCancel();
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/update/asset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId, name: editingName }),
      });

      if (!response.ok) throw new Error('Failed to update asset');

      // Update local state
      setAssets(assets.map(a =>
        a.id === assetId ? { ...a, name: editingName } : a
      ));

      handleEditCancel();
    } catch (error) {
      alert('Failed to update asset: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async (assetId, assetName) => {
    if (!confirm(`Delete "${assetName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/delete/asset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId }),
      });

      if (!response.ok) throw new Error('Failed to delete asset');

      setAssets(assets.filter(a => a.id !== assetId));
    } catch (error) {
      alert('Failed to delete asset: ' + error.message);
    }
  };

  async function handleRemove(id) {
    if (confirm('Remove from watchlist?')) {
      await toggleWatched(id);
      await loadAndDisplay();
    }
  }

  function getMarketName(marketId) {
    return markets.find(m => m.id === marketId)?.name || 'Unknown';
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Assets</h1>
        <p className="text-gray-500">{assets.length} assets total</p>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No assets yet"
          description="Add assets on the Map to see them listed here."
        />
      ) : (
        <div className="grid gap-4">
          {assets.map((asset, i) => (
            <div
              key={asset.id}
              onClick={() => onAssetSelect?.(asset)}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-indigo-600/50 hover:shadow-lg hover:shadow-indigo-600/10 group animate-fade-in card-hover transition-all cursor-pointer"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex justify-between items-start mb-3">
                {editingId === asset.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(asset.id);
                        if (e.key === 'Escape') handleEditCancel();
                      }}
                      className="text-lg font-semibold text-white bg-gray-800 border border-indigo-600 rounded px-2 py-1 flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleEditSave(asset.id)}
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-gray-200 transition-colors duration-200">
                          {asset.name || asset.address}
                        </h3>
                        <button
                          onClick={() => handleEditStart(asset.id, asset.name || asset.address)}
                          className="text-gray-400 hover:text-indigo-400 transition-colors p-1 text-sm"
                          title="Edit asset name"
                        >
                          ✎
                        </button>
                      </div>
                      <p className="text-sm text-gray-400 font-medium mt-1">{getMarketName(asset.market_id)}</p>
                      {getRegionsForPoint(asset, drawings).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {getRegionsForPoint(asset, drawings).map((region) => (
                            <span
                              key={region.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600/15 text-indigo-300 border border-indigo-600/30"
                              title="Inside drawn region"
                            >
                              ◆ {region.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.name || asset.address)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200"
                        title="Delete asset"
                      >
                        🗑
                      </button>
                      <button
                        onClick={() => handleRemove(asset.id)}
                        className="text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors duration-200"
                        title="Unwatch"
                      >
                        ★
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                {asset.asset_class && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs uppercase">Class</p>
                    <p className="text-gray-300 font-medium">{asset.asset_class}</p>
                  </div>
                )}
                {asset.units && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs uppercase">Units</p>
                    <p className="text-gray-300 font-medium">{asset.units}</p>
                  </div>
                )}
                {asset.purchase_price && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs uppercase">Price</p>
                    <p className="text-gray-300 font-mono font-semibold">${asset.purchase_price.toLocaleString()}</p>
                  </div>
                )}
                {asset.cap_rate && (
                  <div>
                    <p className="text-gray-500 font-medium text-xs uppercase">Cap Rate</p>
                    <p className="text-gray-300 font-mono font-semibold">{(asset.cap_rate * 100).toFixed(2)}%</p>
                  </div>
                )}
              </div>

              {asset.notes && (
                <p className="text-sm text-gray-400 mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                  {asset.notes}
                </p>
              )}

              <p className="text-xs text-gray-600 mt-4 font-mono">
                Added: {asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
