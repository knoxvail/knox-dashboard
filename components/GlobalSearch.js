'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadMarkets } from '@/lib/store/marketStore';
import { loadAssets } from '@/lib/store/assetStore';

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  // Set up global keyboard listener
  useEffect(() => {
    function handleKeyDown(e) {
      const target = e.target;

      // Don't hijack keyboard shortcuts (Ctrl/Cmd/Alt) like copy, paste, select-all
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // A page-level search bar (e.g. the Assets search) takes priority for typing
      if (typeof window !== 'undefined' && window.__assetSearchActive) {
        return;
      }

      // Don't intercept if typing in input/textarea or an editable element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Any single alphanumeric key focuses search (ignore multi-char keys like "Tab")
      if (/^[a-zA-Z0-9 ]$/.test(e.key)) {
        inputRef.current?.focus();
      }

      // ESC to blur
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setQuery('');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      const q = query.toLowerCase();
      const markets = await loadMarkets();
      const assets = await loadAssets();

      const marketResults = markets
        .filter(m => m.name.toLowerCase().includes(q) || m.address.toLowerCase().includes(q))
        .slice(0, 2)
        .map(m => ({ type: 'market', data: m, label: m.name, sublabel: m.address }));

      const assetResults = assets
        .filter(a => a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q))
        .slice(0, 3)
        .map(a => ({ type: 'asset', data: a, label: a.name, sublabel: a.address }));

      // Get unique cities from assets
      const cities = new Set();
      assets.forEach(a => {
        const addressParts = a.address.split(',');
        if (addressParts.length >= 2) {
          const city = addressParts[addressParts.length - 3]?.trim();
          if (city && city.toLowerCase().includes(q)) {
            cities.add(city);
          }
        }
      });

      const cityResults = Array.from(cities)
        .slice(0, 2)
        .map(city => ({ type: 'city', label: city, sublabel: 'City' }));

      // Always offer to fly the map to whatever was typed (works for any city/place)
      const allResults = [...marketResults, ...assetResults, ...cityResults];
      allResults.push({ type: 'location', label: query, sublabel: 'Go to on map' });

      setResults(allResults.slice(0, 8));
    };

    performSearch();
  }, [query]);

  function handleSelect(result) {
    const flyTo = (place) =>
      router.push(`/?q=${encodeURIComponent(place)}&qn=${Date.now()}`);

    if (result.type === 'asset') {
      router.push(`/?asset=${result.data.id}&qn=${Date.now()}`);
    } else if (result.type === 'market') {
      // Fly to the market region on the map (avoids the legacy detail page)
      flyTo(result.data.address || result.data.name);
    } else {
      // city or free-text location → geocode + fly there
      flyTo(result.label);
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
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && query.length === 0) {
              setQuery('');
            }
            if (e.key === 'Enter' && results.length > 0) {
              handleSelect(results[0]);
            }
          }}
          placeholder="Search markets, comps, assets..."
          className="w-full px-5 py-3.5 pr-10 bg-gray-900/50 border-b-2 border-gray-700 rounded-lg text-base text-gray-100 placeholder-gray-500 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200 font-semibold"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors duration-200"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in-up">
          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => handleSelect(result)}
              className="w-full px-5 py-4 text-left hover:bg-gray-800/50 border-b border-gray-800/50 last:border-b-0 transition-all duration-150 flex justify-between items-center group list-item"
            >
              <div>
                <p className="text-gray-100 text-base font-medium group-hover:text-white">{result.label}</p>
                <p className="text-gray-500 text-sm">{result.sublabel}</p>
              </div>
              <span className="text-sm font-mono text-gray-600 bg-gray-800 px-3 py-1.5 rounded-lg font-semibold">
                {result.type[0].toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-4 z-50 text-center text-gray-400 text-sm animate-fade-in-up">
          No results found
        </div>
      )}
    </div>
  );
}
