'use client';

import { useEffect, useState } from 'react';
import { getMarketById } from '@/lib/store/marketStore';
import { useParams } from 'next/navigation';

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

export default function MarketDetailPage() {
  const params = useParams();
  const [market, setMarket] = useState(null);

  useEffect(() => {
    const data = getMarketById(params.id);
    setMarket(data);
  }, [params.id]);

  if (!market) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Market not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">{market.name}</h1>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-mono uppercase mb-1">Address</p>
          <p className="text-lg">{market.address}</p>
        </div>

        <div className="bg-white rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-mono uppercase mb-1">Coordinates</p>
          <p className="text-sm font-mono">{market.lat.toFixed(4)}, {market.lng.toFixed(4)}</p>
        </div>

        <div className="bg-white rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-mono uppercase mb-1">Status</p>
          <p className="text-lg font-mono">{STATUS_LABELS[market.status]}</p>
        </div>

        <div className="bg-white rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-600 font-mono uppercase mb-1">Asset Class</p>
          <p className="text-lg font-mono">{ASSET_CLASS_LABELS[market.asset_class]}</p>
        </div>
      </div>

      {market.notes && (
        <div className="bg-white rounded border border-gray-200 p-4 mb-8">
          <p className="text-xs text-gray-600 font-mono uppercase mb-2">Notes</p>
          <p className="text-sm text-gray-700">{market.notes}</p>
        </div>
      )}

      <p className="text-xs text-gray-500 font-mono">
        Created: {new Date(market.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
