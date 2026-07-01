'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import MapView from '@/components/map/MapView';
import { loadMarkets } from '@/lib/store/marketStore';
import { PropertyInfoPanel } from '@/components/map/PropertyInfoPanel';
import AssetsHub from './AssetsHub';
import SettingsView from './SettingsView';
import { useAppView } from '@/lib/appView/AppViewContext';

export default function DashboardLayout() {
  const { view, setView } = useAppView();
  const searchParams = useSearchParams();
  const focusAsset = searchParams.get('asset');
  const focusQuery = searchParams.get('q');
  const focusNonce = searchParams.get('qn');
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  // A search/selection that targets the map should switch to the Map view
  useEffect(() => {
    if (focusQuery) {
      setSelectedAssetId(null);
      setView('map');
    } else if (focusAsset) {
      setSelectedAssetId(focusAsset);
      setView('map');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAsset, focusQuery, focusNonce]);

  useEffect(() => {
    const loadData = async () => {
      const marketsData = await loadMarkets();
      setMarkets(marketsData.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    };
    loadData();
  }, []);

  // The map stays mounted (hidden) for instant switching; nudge it to repaint when shown
  useEffect(() => {
    if (view === 'map') {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
      return () => clearTimeout(t);
    }
  }, [view]);

  const handleAssetSelect = (asset) => {
    setSelectedAssetId(asset.id);
    setView('map');
  };

  return (
    <div className="h-full bg-gray-950">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Loading portfolio...</p>
        </div>
      ) : (
        <>
          {/* Map view — keep mounted so the map instance persists */}
          <div className={`h-full flex flex-col ${view === 'map' ? '' : 'hidden'}`}>
            <MapView markets={markets} selectedAssetId={selectedAssetId} />
            <PropertyInfoPanel />
          </div>

          {/* Database view */}
          {view === 'database' && (
            <div className="h-full overflow-y-auto">
              <AssetsHub onAssetSelect={handleAssetSelect} />
            </div>
          )}

          {/* Settings */}
          {view === 'settings' && (
            <div className="h-full overflow-y-auto">
              <SettingsView />
            </div>
          )}
        </>
      )}
    </div>
  );
}
