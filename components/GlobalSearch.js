'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadMarkets } from '@/lib/store/marketStore';
import { loadComps } from '@/lib/store/compStore';
import { loadAssets } from '@/lib/store/assetStore';

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const markets = loadMarkets();
    const comps = loadComps();
    const assets = loadAssets();

    const marketResults = markets
      .filter(m => m.name.toLowerCase().includes(q) || m.address.toLowerCase().includes(q))
      .slice(0, 3)
      .map(m => ({ type: 'market', data: m, label: m.name, sublabel: m.address }));

    const compResults = comps
      .filter(c => c.address.toLowerCase().includes(q))
      .slice(0, 3)
      .map(c => ({ type: 'comp', data: c, label: c.address, sublabel: `${c.comp_type} • ${new Date(c.date).toLocaleDateString()}` }));

    const assetResults = assets
      .filter(a => a.address.toLowerCase().includes(q))
      .slice(0, 3)
      .map(a => ({ type: 'asset', data: a, label: a.address, sublabel: a.watched ? '⭐ Watched' : 'Asset' }));

    setResults([...marketResults, ...compResults, ...assetResults].slice(0, 8));
  }, [query]);

  function handleSelect(result) {
    if (result.type === 'market') {
      router.push(`/markets/${result.data.id}`);
    } else if (result.type === 'comp') {
      router.push(`/comps`);
    } else if (result.type === 'asset') {
      router.push(`/watchlist`);
    }
    setQuery('');
    setIsOpen(false);
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 100)}
          placeholder="Search markets, comps, assets..."
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-200"
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-mono text-xs">
          ⌘K
        </span>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 animate-fade-in">
          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition-colors duration-150 flex justify-between items-center group"
            >
              <div>
                <p className="text-gray-100 text-sm font-medium group-hover:text-white">{result.label}</p>
                <p className="text-gray-500 text-xs">{result.sublabel}</p>
              </div>
              <span className="text-xs font-mono text-gray-600 bg-gray-800 px-2 py-1 rounded">
                {result.type[0].toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-4 z-50 text-center text-gray-400 text-sm animate-fade-in">
          No results found
        </div>
      )}
    </div>
  );
}
