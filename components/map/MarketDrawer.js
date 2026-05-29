'use client';

import { useRouter } from 'next/navigation';

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

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-lg z-50 overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <h2 className="text-xl font-bold">{market.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-600 font-mono uppercase">Address</p>
            <p className="text-sm">{market.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 font-mono uppercase">Status</p>
              <p className="text-sm font-mono">{STATUS_LABELS[market.status]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-mono uppercase">Asset Class</p>
              <p className="text-sm font-mono">{ASSET_CLASS_LABELS[market.asset_class]}</p>
            </div>
          </div>

          {market.score && (
            <div>
              <p className="text-xs text-gray-600 font-mono uppercase">Score</p>
              <p className="text-lg font-mono font-bold">{market.score}</p>
            </div>
          )}

          {market.notes && (
            <div>
              <p className="text-xs text-gray-600 font-mono uppercase">Notes</p>
              <p className="text-sm text-gray-700">{market.notes}</p>
            </div>
          )}

          <div className="pt-4">
            <button
              onClick={() => {
                router.push(`/markets/${market.id}`);
                onClose();
              }}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded text-sm font-mono hover:bg-gray-800"
            >
              View Full Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
