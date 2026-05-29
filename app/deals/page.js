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
    green: 'bg-emerald-600/20 text-emerald-300',
    yellow: 'bg-amber-600/20 text-amber-300',
    red: 'bg-red-600/20 text-red-300',
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-white">Deal Scoring</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Analyze Deal</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Market</label>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
              >
                {markets.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2 font-medium">
                {selectedMarket && `Comps: ${getCompsByMarket(selectedMarket).length}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cap Rate %</label>
                <input
                  type="number"
                  value={deal.cap_rate}
                  onChange={(e) => setDeal(prev => ({ ...prev, cap_rate: e.target.value }))}
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rent/SF</label>
                <input
                  type="number"
                  value={deal.rent_per_sf}
                  onChange={(e) => setDeal(prev => ({ ...prev, rent_per_sf: e.target.value }))}
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Vacancy %</label>
              <input
                type="number"
                value={deal.vacancy_rate}
                onChange={(e) => setDeal(prev => ({ ...prev, vacancy_rate: e.target.value }))}
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
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
              className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors duration-200"
            >
              Calculate Score
            </button>
          </div>
        </div>

        {scoreResult && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-5">Score Result</h2>

            <div className={`rounded-xl p-5 mb-5 ${recommendationColors[scoreRecommendation.color]}`}>
              <p className="text-xs font-medium uppercase tracking-wide">Recommendation</p>
              <p className="text-4xl font-bold mt-2">{scoreRecommendation.status}</p>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-5 mb-5 border border-gray-800">
              <p className="text-gray-400 font-medium text-xs mb-2">Overall Score</p>
              <p className="text-5xl font-bold text-white">{scoreResult.score}</p>
              <div className="w-full bg-gray-800 rounded-full h-2 mt-3">
                <div
                  className="bg-gray-600 h-2 rounded-full"
                  style={{ width: `${Math.min(scoreResult.score, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-gray-400 font-medium text-xs mb-3">Breakdown</p>
              {Object.entries(scoreResult.breakdown).map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').trim();
                return (
                  <div key={key} className="mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">{label}</span>
                      <span className="text-gray-300 font-mono font-semibold">{Math.round(value)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
                      <div
                        className="bg-indigo-600 h-1 rounded-full"
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
