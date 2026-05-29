'use client';

import { useEffect, useState } from 'react';
import { loadMarkets, deleteMarket } from '@/lib/store/marketStore';
import AddMarketForm from '@/components/forms/AddMarketForm';
import { useRouter } from 'next/navigation';

const STATUS_LABELS = {
  scouting: 'Scouting',
  active: 'Active',
  passed: 'Passed',
  closed: 'Closed',
};

export default function MarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadAndDisplay();
  }, []);

  function loadAndDisplay() {
    const data = loadMarkets();
    setMarkets(data);
  }

  function handleDelete(id) {
    if (confirm('Delete this market?')) {
      deleteMarket(id);
      loadAndDisplay();
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Markets</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-mono hover:bg-gray-800"
        >
          + Add Market
        </button>
      </div>

      {markets.length === 0 ? (
        <p className="text-gray-500">No markets yet. Add one from the map or here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2 font-mono">Name</th>
                <th className="text-left px-4 py-2 font-mono">Address</th>
                <th className="text-left px-4 py-2 font-mono">Status</th>
                <th className="text-left px-4 py-2 font-mono">Asset Class</th>
                <th className="text-left px-4 py-2 font-mono">Score</th>
                <th className="text-right px-4 py-2 font-mono">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markets.map(market => (
                <tr key={market.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">{market.name}</td>
                  <td className="px-4 py-3 text-gray-600">{market.address}</td>
                  <td className="px-4 py-3 font-mono">{STATUS_LABELS[market.status]}</td>
                  <td className="px-4 py-3 font-mono">{market.asset_class}</td>
                  <td className="px-4 py-3 font-mono">{market.score || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => router.push(`/markets/${market.id}`)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(market.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AddMarketForm
          onClose={() => {
            setShowForm(false);
            loadAndDisplay();
          }}
          onSuccess={() => {
            loadAndDisplay();
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
