'use client';

import { useEffect, useState } from 'react';
import { loadMarkets } from '@/lib/store/marketStore';
import { getCompsByMarket } from '@/lib/store/compStore';
import { calculateScore, getRecommendation } from '@/lib/utils/scoreCalculator';

export default function DealsPage() {
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [deal, setDeal] = useState({
    cap_rate: '',
    rent_per_sf: '',
    vacancy_rate: '',
    locationQuality: 50,
  });
  const [scoreResult, setScoreResult] = useState(null);

  useEffect(() => {
    const marketsData = loadMarkets();
    setMarkets(marketsData);
    if (marketsData.length > 0) {
      setSelectedMarket(marketsData[0].id);
    }
  }, []);

  function handleScore() {
    if (!selectedMarket || !deal.cap_rate || !deal.rent_per_sf) {
      alert('Please fill in cap rate and rent/SF');
      return;
    }

    const comps = getCompsByMarket(selectedMarket);
    const dealData = {
      cap_rate: parseFloat(deal.cap_rate) / 100,
      rent_per_sf: parseFloat(deal.rent_per_sf),
      vacancy_rate: parseFloat(deal.vacancy_rate) / 100,
      locationQuality: parseFloat(deal.locationQuality),
    };

    const result = calculateScore(dealData, comps);
    setScoreResult(result);
  }

  const scoreRecommendation = scoreResult ? getRecommendation(scoreResult.score) : null;
  const recommendationColors = {
    green: 'bg-green-900/40 border-green-800 text-green-300',
    yellow: 'bg-yellow-900/40 border-yellow-800 text-yellow-300',
    red: 'bg-red-900/40 border-red-800 text-red-300',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-white">Deal Scoring</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-950 border border-gray-800 rounded p-6">
          <h2 className="text-lg font-bold text-white mb-4">Analyze Deal</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">Market</label>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
              >
                {markets.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                {selectedMarket && `Comps: ${getCompsByMarket(selectedMarket).length}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">Cap Rate %</label>
                <input
                  type="number"
                  value={deal.cap_rate}
                  onChange={(e) => setDeal(prev => ({ ...prev, cap_rate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">Rent/SF</label>
                <input
                  type="number"
                  value={deal.rent_per_sf}
                  onChange={(e) => setDeal(prev => ({ ...prev, rent_per_sf: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">Vacancy %</label>
              <input
                type="number"
                value={deal.vacancy_rate}
                onChange={(e) => setDeal(prev => ({ ...prev, vacancy_rate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">
                Location Quality (0-100)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={deal.locationQuality}
                onChange={(e) => setDeal(prev => ({ ...prev, locationQuality: e.target.value }))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">{deal.locationQuality}</p>
            </div>

            <button
              onClick={handleScore}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
            >
              Calculate Score
            </button>
          </div>
        </div>

        {scoreResult && (
          <div className="bg-gray-950 border border-gray-800 rounded p-6">
            <h2 className="text-lg font-bold text-white mb-4">Score Result</h2>

            <div className={`border rounded p-4 mb-4 ${recommendationColors[scoreRecommendation.color]}`}>
              <p className="text-sm font-mono font-bold">RECOMMENDATION</p>
              <p className="text-3xl font-bold">{scoreRecommendation.status}</p>
            </div>

            <div className="bg-gray-900 rounded p-4 mb-4">
              <p className="text-gray-400 font-mono text-sm mb-2">Overall Score</p>
              <p className="text-4xl font-bold text-white">{scoreResult.score}</p>
              <div className="w-full bg-gray-800 rounded h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded"
                  style={{ width: `${Math.min(scoreResult.score, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-gray-400 font-mono text-sm mb-3">Breakdown</p>
              {Object.entries(scoreResult.breakdown).map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').trim();
                return (
                  <div key={key} className="mb-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{label}</span>
                      <span className="text-gray-300 font-mono">{Math.round(value)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded h-1">
                      <div
                        className="bg-gray-500 h-1 rounded"
                        style={{ width: `${Math.min(value, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
