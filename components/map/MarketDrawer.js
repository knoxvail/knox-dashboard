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
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-900 border-l border-gray-800 shadow-lg z-50 overflow-y-auto flex flex-col animate-fade-in">
        <div className="p-6 border-b border-gray-800 flex justify-between items-start">
          <h2 className="text-xl font-semibold text-white">{market.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors duration-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Address</p>
            <p className="text-sm text-gray-300 font-medium mt-1">{market.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</p>
              <p className="text-sm font-mono text-gray-300 font-semibold mt-1">{STATUS_LABELS[market.status]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Asset Class</p>
              <p className="text-sm font-mono text-gray-300 font-semibold mt-1">{ASSET_CLASS_LABELS[market.asset_class]}</p>
            </div>
          </div>

          {market.score && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Score</p>
              <p className="text-2xl font-mono font-bold text-gray-300 mt-1">{market.score}</p>
            </div>
          )}

          {market.notes && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Notes</p>
              <p className="text-sm text-gray-400 mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-800">{market.notes}</p>
            </div>
          )}

          <div className="pt-4 space-y-2">
            <button
              onClick={() => setIsEditing(true)}
              className="w-full px-4 py-2.5 bg-gray-800 text-gray-100 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
            >
              Edit
            </button>
            <button
              onClick={() => {
                router.push(`/markets/${market.id}`);
                onClose();
              }}
              className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors duration-200"
            >
              View Full Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
