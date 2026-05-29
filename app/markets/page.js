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
        <h1 className="text-3xl font-bold text-white">Markets</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 shadow-md transition-all duration-200"
        >
          + Add Market
        </button>
      </div>

      {markets.length === 0 ? (
        <p className="text-gray-400">No markets yet. Add one from the map or here.</p>
      ) : (
        <div className="grid gap-4">
          {markets.map((market, i) => (
            <div
              key={market.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer group animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => router.push(`/markets/${market.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-gray-200 transition-colors duration-200">
                    {market.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1.5">{market.address}</p>
                </div>
                <div className="flex gap-2 items-center">
                  {market.score && (
                    <div className="bg-gray-800/50 rounded-full px-3 py-1.5">
                      <p className="text-sm font-mono text-gray-300 font-semibold">{market.score}</p>
                    </div>
                  )}
                  <div className={`badge badge-${market.status}`}>
                    {STATUS_LABELS[market.status]}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-4 text-xs text-gray-500 font-medium">
                <span>{market.asset_class}</span>
              </div>
              <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/markets/${market.id}`);
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium"
                >
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(market.id);
                  }}
                  className="text-xs px-3 py-1.5 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors duration-200 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
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
