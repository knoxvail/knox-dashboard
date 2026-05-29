'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import AddMarketForm from '../forms/AddMarketForm';

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

export default function MarketDrawer({ market, onClose }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <AddMarketForm
        market={market}
        onClose={() => setIsEditing(false)}
        onSuccess={() => {
          setIsEditing(false);
          onClose();
        }}
      />
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-950 border-l border-gray-800 shadow-lg z-50 overflow-y-auto">
        <div className="p-6 border-b border-gray-800 flex justify-between items-start">
          <h2 className="text-xl font-bold text-white">{market.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase">Address</p>
            <p className="text-sm text-gray-300">{market.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-mono uppercase">Status</p>
              <p className="text-sm font-mono text-gray-300">{STATUS_LABELS[market.status]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-mono uppercase">Asset Class</p>
              <p className="text-sm font-mono text-gray-300">{ASSET_CLASS_LABELS[market.asset_class]}</p>
            </div>
          </div>

          {market.score && (
            <div>
              <p className="text-xs text-gray-500 font-mono uppercase">Score</p>
              <p className="text-lg font-mono font-bold text-white">{market.score}</p>
            </div>
          )}

          {market.notes && (
            <div>
              <p className="text-xs text-gray-500 font-mono uppercase">Notes</p>
              <p className="text-sm text-gray-400">{market.notes}</p>
            </div>
          )}

          <div className="pt-4 space-y-2">
            <button
              onClick={() => setIsEditing(true)}
              className="w-full px-4 py-2 bg-gray-800 text-gray-100 rounded text-sm font-mono hover:bg-gray-700 border border-gray-700"
            >
              Edit
            </button>
            <button
              onClick={() => {
                router.push(`/markets/${market.id}`);
                onClose();
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
            >
              View Full Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
