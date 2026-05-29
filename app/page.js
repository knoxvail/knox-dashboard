'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MapView from '@/components/map/MapView';
import AssetDrawer from '@/components/map/AssetDrawer';
import { loadMarkets } from '@/lib/store/marketStore';
import { getAssetById } from '@/lib/store/assetStore';

export default function Dashboard() {
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    const markets = loadMarkets();
    setMarkets(markets);
    setLoading(false);
  }, []);

  useEffect(() => {
    const assetId = searchParams.get('asset');
    if (assetId) {
      const asset = getAssetById(assetId);
      setSelectedAsset(asset);
    } else {
      setSelectedAsset(null);
    }
  }, [searchParams]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading map...</p>
          </div>
        ) : (
          <MapView markets={markets} selectedAssetId={searchParams.get('asset')} />
        )}
      </div>
      {selectedAsset && (
        <AssetDrawer
          asset={selectedAsset}
          onClose={() => {
            setSelectedAsset(null);
            window.history.replaceState({}, '', '/');
          }}
        />
      )}
    </div>
  );
}
