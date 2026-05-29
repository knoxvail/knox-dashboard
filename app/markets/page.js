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
        <h1 className="text-2xl font-bold text-white">Markets</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
        >
          + Add Market
        </button>
      </div>

      {markets.length === 0 ? (
        <p className="text-gray-400">No markets yet. Add one from the map or here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2 font-mono text-gray-400">Name</th>
                <th className="text-left px-4 py-2 font-mono text-gray-400">Address</th>
                <th className="text-left px-4 py-2 font-mono text-gray-400">Status</th>
                <th className="text-left px-4 py-2 font-mono text-gray-400">Asset Class</th>
                <th className="text-left px-4 py-2 font-mono text-gray-400">Score</th>
                <th className="text-right px-4 py-2 font-mono text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markets.map(market => (
                <tr key={market.id} className="border-b border-gray-800 hover:bg-gray-900">
                  <td className="px-4 py-3 text-gray-100">{market.name}</td>
                  <td className="px-4 py-3 text-gray-400">{market.address}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">{STATUS_LABELS[market.status]}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">{market.asset_class}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">{market.score || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => router.push(`/markets/${market.id}`)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(market.id)}
                      className="text-red-400 hover:text-red-300"
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
