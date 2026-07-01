'use client';

import { useEffect, useRef, useState } from 'react';
import { loadAssets, toggleWatched } from '@/lib/store/assetStore';
import { loadDrawings } from '@/lib/store/drawingStore';
import { pointInPolygon, isDrawingInside } from '@/lib/utils/geo';
import EmptyState from '@/components/EmptyState';
import BrokersView from './BrokersView';
import AssetDetail from './AssetDetail';

const STATUS = {
  scouting: { c: '#f59e0b', l: 'Scouting' },
  active: { c: '#6366f1', l: 'Active' },
  passed: { c: '#ef4444', l: 'Passed' },
  closed: { c: '#10b981', l: 'Closed' },
};

// Responsive grid of asset boxes within each region
const GRID = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start';

export default function AssetsHub({ onAssetSelect }) {
  const [assets, setAssets] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [watchOnly, setWatchOnly] = useState(false);
  const [tab, setTab] = useState('assets'); // 'assets' | 'brokers'
  const [query, setQuery] = useState('');
  const [detailAsset, setDetailAsset] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    loadAndDisplay();
    loadDrawings().then(setDrawings);
  }, []);

  useEffect(() => {
    window.__assetSearchActive = true;
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (/^[a-zA-Z0-9 ]$/.test(e.key)) searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.__assetSearchActive = false;
    };
  }, []);

  async function loadAndDisplay() {
    const all = await loadAssets();
    setAssets([...all]);
  }

  const markets = drawings.filter((d) => d.kind === 'market').sort((a, b) => a.name.localeCompare(b.name));
  const regions = drawings.filter((d) => d.kind !== 'market');

  function inPoly(asset, d) {
    return asset.lat != null && asset.lng != null && Array.isArray(d.paths) && pointInPolygon({ lat: asset.lat, lng: asset.lng }, d.paths);
  }
  const visibleAssets = watchOnly ? assets.filter((a) => a.watched) : assets;
  const byRating = (list) =>
    [...list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (a.name || a.address || '').localeCompare(b.name || b.address || ''));

  // --- filter-in-place search ---
  const q = query.trim().toLowerCase();
  const assetMatches = (a) =>
    !q || [a.name, a.address, a.notes, a.property_type].some((v) => (v || '').toLowerCase().includes(q));
  const nameMatches = (d) => !!q && (d.name || '').toLowerCase().includes(q);
  // Assets shown inside a group; `force` shows them all (group name matched the query)
  const shownIn = (d, force) => byRating(visibleAssets.filter((a) => inPoly(a, d)).filter((a) => force || assetMatches(a)));

  async function handleDelete(e, id, name) {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/delete/asset', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('Failed to delete asset');
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) { alert('Failed to delete asset: ' + err.message); }
  }
  async function handleWatch(e, id) { e.stopPropagation(); await toggleWatched(id); await loadAndDisplay(); }

  // --- asset box ---
  function AssetBox(asset) {
    const st = STATUS[asset.status] || { c: '#808080', l: asset.status || '—' };
    return (
      <div
        key={asset.id}
        onClick={() => setDetailAsset(asset)}
        className="cursor-pointer text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-indigo-600/50 hover:bg-gray-800/40 transition-colors group relative flex flex-col"
        title="Open asset page"
      >
        <span className="block text-base font-semibold text-gray-100 leading-snug pr-12">{asset.name || asset.address}</span>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.c }} />
          <span className="text-xs text-gray-400">{st.l}</span>
          {asset.property_type && <span className="text-xs text-gray-600 truncate">· {asset.property_type}</span>}
        </div>
        {asset.address && <p className="text-xs text-gray-500 mt-1 truncate">{asset.address}</p>}
        {(asset.estimated_value != null || asset.asking_price != null || asset.units != null) && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs font-mono">
            {asset.estimated_value != null && <span className="text-indigo-400">Est ${Number(asset.estimated_value).toLocaleString()}</span>}
            {asset.asking_price != null && <span className="text-emerald-400">Ask ${Number(asset.asking_price).toLocaleString()}</span>}
            {asset.units != null && <span className="text-gray-400">{asset.units} units</span>}
          </div>
        )}
        {asset.notes && (
          <p className="text-sm text-gray-400 mt-2.5 whitespace-pre-wrap leading-relaxed border-t border-gray-800/70 pt-2.5">{asset.notes}</p>
        )}
        <div className="mt-auto pt-3">
          <span className="text-sm font-bold text-amber-300">{asset.rating != null ? `★ ${asset.rating}` : <span className="text-gray-700">★ —</span>}</span>
        </div>
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <span onClick={(e) => handleWatch(e, asset.id)} className={`cursor-pointer text-base ${asset.watched ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300'}`} title="Watchlist">★</span>
          <span onClick={(e) => handleDelete(e, asset.id, asset.name || asset.address)} className="cursor-pointer text-base text-gray-600 hover:text-red-400" title="Delete">🗑</span>
        </div>
      </div>
    );
  }

  function RegionRows(region, parentMatch) {
    const force = parentMatch || nameMatches(region);
    const items = shownIn(region, force);
    // While filtering, a region with no hits disappears entirely
    if (q && !force && items.length === 0) return null;
    return (
      <div key={region.id} className="mt-4 ml-3 pl-3 border-l border-gray-800">
        <div id={`grp-${region.id}`} className="flex items-center gap-2 mb-2.5">
          <span style={{ color: region.color || '#6366f1' }}>◆</span>
          <span className="text-sm font-semibold text-gray-200">{region.name}</span>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{items.length}</span>
        </div>
        {items.length > 0 && <div className={GRID}>{items.map((a) => AssetBox(a))}</div>}
      </div>
    );
  }

  const looseRegions = regions.filter((r) => !markets.some((m) => isDrawingInside(r, m)));
  const orphanAssets = byRating(
    visibleAssets.filter((a) => !markets.some((m) => inPoly(a, m)) && !regions.some((r) => inPoly(a, r))).filter(assetMatches)
  );
  const hasAnything = assets.length > 0 || drawings.length > 0;
  const anyMatch = !q || visibleAssets.some(assetMatches) || drawings.some(nameMatches);

  // --- asset detail page ---
  if (tab === 'assets' && detailAsset) {
    return (
      <AssetDetail
        asset={detailAsset}
        drawings={drawings}
        onBack={async () => { setDetailAsset(null); await loadAndDisplay(); }}
        onShowMap={() => onAssetSelect?.(detailAsset)}
      />
    );
  }

  return (
    <div>
      {/* Sticky header: title, tabs, watchlist, filter */}
      <div className="sticky top-0 z-20 bg-gray-950 px-6 pt-5 pb-2 border-b border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Database</h1>
            <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
              <button
                onClick={() => setTab('assets')}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${tab === 'assets' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Assets
              </button>
              <button
                onClick={() => setTab('brokers')}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${tab === 'brokers' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                ☎ Brokers
              </button>
            </div>
          </div>
          {tab === 'assets' && (
            <button
              onClick={() => setWatchOnly((v) => !v)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${watchOnly ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'}`}
            >
              ★ Watchlist{watchOnly ? ' · on' : ''}
            </button>
          )}
        </div>

        <div className={`relative max-w-xl mb-3 ${tab === 'brokers' ? 'hidden' : ''}`}>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.target.blur(); } }}
            placeholder="Filter assets, regions, markets…"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 outline-none"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">✕</button>}
        </div>

      </div>

      {tab === 'brokers' ? (
        <div className="px-6 pb-10 pt-4">
          <BrokersView />
        </div>
      ) : (
      <div className="px-6 pb-10">
        {!hasAnything ? (
          <EmptyState icon="📍" title="No assets yet" description="Add assets on the Map, then draw markets/regions to group them." />
        ) : !anyMatch ? (
          <p className="text-gray-600 text-sm mt-8 text-center">No assets, regions, or markets match “{query.trim()}”.</p>
        ) : (
          <>
            {markets.map((m) => {
              const mMatch = nameMatches(m);
              const marketRegions = regions.filter((r) => isDrawingInside(r, m));
              const regionNodes = marketRegions.map((r) => RegionRows(r, mMatch)).filter(Boolean);
              const marketAssets = shownIn(m, mMatch);
              const looseInMarket = marketAssets.filter((a) => !marketRegions.some((r) => inPoly(a, r)));
              // While filtering, a market with no hits anywhere disappears
              if (q && !mMatch && regionNodes.length === 0 && looseInMarket.length === 0) return null;
              return (
                <div key={m.id} id={`grp-${m.id}`} className="mt-7 first:mt-2">
                  <div className="flex items-center gap-2 mb-1 px-1 border-b border-gray-800 pb-1">
                    <span className="text-gray-400">▢</span>
                    <span className="text-lg font-bold text-white">{m.name}</span>
                    <span className="text-[10px] font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{marketAssets.length}</span>
                  </div>
                  {regionNodes}
                  {looseInMarket.length > 0 && (
                    <div className="mt-4 ml-3 pl-3 border-l border-gray-800">
                      <div className="mb-2.5"><span className="text-sm font-semibold text-gray-400">Directly in market</span></div>
                      <div className={GRID}>{looseInMarket.map((a) => AssetBox(a))}</div>
                    </div>
                  )}
                </div>
              );
            })}

            {(() => {
              const looseRegionNodes = looseRegions.map((r) => RegionRows(r, false)).filter(Boolean);
              if (looseRegionNodes.length === 0 && orphanAssets.length === 0) return null;
              return (
                <div className="mt-7">
                  <div className="flex items-center gap-2 mb-1 px-1 border-b border-gray-800 pb-1">
                    <span className="text-lg font-bold text-gray-400">Outside any market</span>
                  </div>
                  {looseRegionNodes}
                  {orphanAssets.length > 0 && (
                    <div className="mt-4 ml-3 pl-3 border-l border-gray-800">
                      <div className="mb-2.5"><span className="text-sm font-semibold text-gray-500">No region</span></div>
                      <div className={GRID}>{orphanAssets.map((a) => AssetBox(a))}</div>
                    </div>
                  )}
                </div>
              );
            })()}

            {markets.length === 0 && !q && (
              <p className="text-xs text-gray-600 mt-4">Tip: hover “Draw Area” on the map and pick <span className="text-gray-400">Market (outline)</span> to draw market boundaries.</p>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
