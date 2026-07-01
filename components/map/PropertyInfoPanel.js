'use client';

import { useState, useEffect } from 'react';

export function PropertyInfoPanel() {
  const [hoveredProperty, setHoveredProperty] = useState(null);
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    // Load properties from global state or context
    // For now, we'll listen for custom events from the map
    const handlePropertyHover = (e) => {
      setHoveredProperty(e.detail);
    };

    const handlePropertyLeave = () => {
      setHoveredProperty(null);
    };

    window.addEventListener('propertyHover', handlePropertyHover);
    window.addEventListener('propertyLeave', handlePropertyLeave);

    return () => {
      window.removeEventListener('propertyHover', handlePropertyHover);
      window.removeEventListener('propertyLeave', handlePropertyLeave);
    };
  }, []);

  if (!hoveredProperty) {
    return null;
  }

  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return `$${(value / 1000000).toFixed(2)}M`;
  };

  const formatPercent = (value) => {
    if (!value) return 'N/A';
    return `${(value).toFixed(2)}%`;
  };

  return (
    <div className="fixed bottom-4 left-56 z-20 bg-gray-900 border border-gray-800 rounded-lg shadow-xl p-4 w-72 animate-fade-in">
      {/* Property Name */}
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white font-mono truncate">{hoveredProperty.name}</h3>
        <p className="text-xs text-gray-400">{hoveredProperty.market}</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Cap Rate */}
        {hoveredProperty.cap_rate !== undefined && (
          <div>
            <p className="text-gray-500 uppercase tracking-wide">Cap Rate</p>
            <p className="text-indigo-400 font-mono font-bold">
              {formatPercent(hoveredProperty.cap_rate)}
            </p>
          </div>
        )}

        {/* Value/Price */}
        {hoveredProperty.purchase_price !== undefined && (
          <div>
            <p className="text-gray-500 uppercase tracking-wide">Purchase Price</p>
            <p className="text-indigo-400 font-mono font-bold">
              {formatCurrency(hoveredProperty.purchase_price)}
            </p>
          </div>
        )}

        {/* Units */}
        {hoveredProperty.units !== undefined && (
          <div>
            <p className="text-gray-500 uppercase tracking-wide">Units</p>
            <p className="text-indigo-400 font-mono font-bold">{hoveredProperty.units}</p>
          </div>
        )}

        {/* Status */}
        {hoveredProperty.status && (
          <div>
            <p className="text-gray-500 uppercase tracking-wide">Status</p>
            <p className="text-indigo-400 font-mono font-bold capitalize">{hoveredProperty.status}</p>
          </div>
        )}

        {/* NOI */}
        {hoveredProperty.noi !== undefined && (
          <div>
            <p className="text-gray-500 uppercase tracking-wide">NOI</p>
            <p className="text-indigo-400 font-mono font-bold">
              {formatCurrency(hoveredProperty.noi)}
            </p>
          </div>
        )}

        {/* Asset Class */}
        {hoveredProperty.asset_class && (
          <div>
            <p className="text-gray-500 uppercase tracking-wide">Asset Class</p>
            <p className="text-indigo-400 font-mono font-bold capitalize">
              {hoveredProperty.asset_class}
            </p>
          </div>
        )}
      </div>

      {/* Score Badge */}
      {hoveredProperty.score !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="inline-block bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded text-xs font-mono">
            Score: {hoveredProperty.score}/10
          </div>
        </div>
      )}
    </div>
  );
}
