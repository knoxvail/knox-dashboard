'use client';

import { useEffect, useState } from 'react';
import MapView from '@/components/map/MapView';
import { loadMarkets } from '@/lib/store/marketStore';

export default function Dashboard() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const markets = loadMarkets();
    setMarkets(markets);
    setLoading(false);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading map...</p>
          </div>
        ) : (
          <MapView markets={markets} />
        )}
      </div>
    </div>
  );
}
