'use client';

import { useEffect, useState } from 'react';
import { getMarketById, updateMarket } from '@/lib/store/marketStore';
import { loadMarkets } from '@/lib/store/marketStore';
import { useParams } from 'next/navigation';

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

function EditableField({ label, value, onChange, onSave, type = 'text' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-gray-950 rounded border border-gray-800 p-4 card-hover cursor-pointer">
        <p className="text-xs text-gray-500 font-mono uppercase mb-2">{label}</p>
        {type === 'textarea' ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-gray-900/50 border-b-2 border-gray-500 text-lg text-gray-100 rounded px-2 py-1 outline-none"
            rows={3}
          />
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-gray-900/50 border-b-2 border-gray-500 text-lg text-gray-100 rounded px-2 py-1 outline-none"
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="bg-gray-950 rounded border border-gray-800 p-4 card-hover cursor-pointer transition-all duration-200 hover:border-gray-700"
    >
      <p className="text-xs text-gray-500 font-mono uppercase mb-1">{label}</p>
      <p className="text-lg text-gray-100">{value}</p>
    </div>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const [market, setMarket] = useState(null);
  const [parentMarketName, setParentMarketName] = useState('');

  useEffect(() => {
    const data = getMarketById(params.id);
    setMarket(data);

    // Look up parent market name if market_id exists
    if (data?.market_id) {
      const parentMarket = getMarketById(data.market_id);
      if (parentMarket) {
        setParentMarketName(parentMarket.name);
      }
    }
  }, [params.id]);

  const handleSave = (field, value) => {
    if (market) {
      const updated = { ...market, [field]: value };
      updateMarket(market.id, { [field]: value });
      setMarket(updated);
    }
  };

  if (!market) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Market not found.</p>
      </div>
    );
  }

  const coordinates = `${market.lat.toFixed(4)}, ${market.lng.toFixed(4)}`;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">{market.name}</h1>
        {parentMarketName && (
          <p className="text-lg text-gray-400">{parentMarketName}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <EditableField
          label="Address"
          value={market.address}
          onSave={(val) => handleSave('address', val)}
          type="textarea"
        />

        <EditableField
          label="Coordinates"
          value={coordinates}
          onSave={() => {}} // Coordinates are read-only
        />

        <div className="bg-gray-950 rounded border border-gray-800 p-4 card-hover cursor-pointer transition-all duration-200 hover:border-gray-700" onClick={() => {}}>
          <p className="text-xs text-gray-500 font-mono uppercase mb-1">Status</p>
          <select
            value={market.status}
            onChange={(e) => handleSave('status', e.target.value)}
            className="w-full bg-gray-900/50 border-b-2 border-gray-500 text-lg text-gray-100 rounded px-2 py-1 outline-none"
          >
            <option value="scouting">Scouting</option>
            <option value="active">Active</option>
            <option value="passed">Passed</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="bg-gray-950 rounded border border-gray-800 p-4 card-hover cursor-pointer transition-all duration-200 hover:border-gray-700" onClick={() => {}}>
          <p className="text-xs text-gray-500 font-mono uppercase mb-1">Asset Class</p>
          <select
            value={market.asset_class}
            onChange={(e) => handleSave('asset_class', e.target.value)}
            className="w-full bg-gray-900/50 border-b-2 border-gray-500 text-lg text-gray-100 rounded px-2 py-1 outline-none"
          >
            <option value="multifamily">Multifamily</option>
            <option value="mixed-use">Mixed-Use</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      {market.notes && (
        <EditableField
          label="Notes"
          value={market.notes}
          onSave={(val) => handleSave('notes', val)}
          type="textarea"
        />
      )}

      <p className="text-xs text-gray-500 font-mono">
        Created: {new Date(market.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
