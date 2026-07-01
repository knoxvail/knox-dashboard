'use client';

import { useEffect, useRef, useState } from 'react';
import { pointInPolygon, getRegionsForPoint } from '@/lib/utils/geo';

const STATUS_LABELS = {
  scouting: 'Scouting',
  active: 'Active',
  passed: 'Passed',
  closed: 'Closed',
};
const STATUS_OPTIONS = ['scouting', 'active', 'passed', 'closed'];

export default function AssetDetail({ asset, drawings = [], onBack, onShowMap }) {
  const [data, setData] = useState(asset);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [propertyImage, setPropertyImage] = useState(null);
  const skipBlurRef = useRef(false);

  const regions = getRegionsForPoint(data, drawings.filter((d) => d.kind !== 'market'));
  const marketsIn = drawings.filter(
    (d) => d.kind === 'market' && data.lat != null && Array.isArray(d.paths) && pointInPolygon({ lat: data.lat, lng: data.lng }, d.paths)
  );
  const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(data.address || '')}`;

  useEffect(() => {
    let alive = true;
    fetch(`/api/search/property-image?q=${encodeURIComponent(`${asset.name} ${asset.address}`)}`)
      .then((r) => r.json())
      .then((result) => { if (alive && result.imageUrl) setPropertyImage(result.imageUrl); })
      .catch(() => {});
    return () => { alive = false; };
  }, [asset.name, asset.address]);

  function startEdit(field, value) {
    setEditing(field);
    setDraft(value == null ? '' : String(value));
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  async function saveEdit(field, { numeric = false } = {}) {
    let value = draft.trim();
    if (value === '') value = null;
    else if (numeric) {
      value = parseFloat(value.replace(/[$,]/g, ''));
      if (isNaN(value)) value = null;
    }
    if (field === 'rating' && value != null) value = Math.max(0, Math.min(10, value));

    const prev = data[field];
    setData((d) => ({ ...d, [field]: value }));
    setEditing(null);
    setDraft('');

    setSaving(true);
    try {
      const body = { id: data.id, [field]: value };
      if (field === 'address' && value) {
        try {
          const g = await fetch(`/api/geocode?address=${encodeURIComponent(value)}`).then((r) => r.json());
          if (g && g.lat != null) {
            body.lat = g.lat;
            body.lng = g.lng;
            setData((d) => ({ ...d, lat: g.lat, lng: g.lng }));
          }
        } catch {}
      }
      const res = await fetch('/api/update/asset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
    } catch (e) {
      console.error('Failed to save', field, e);
      setData((d) => ({ ...d, [field]: prev }));
    } finally {
      setSaving(false);
    }
  }

  async function savePlain(field, value) {
    const prev = data[field];
    setData((d) => ({ ...d, [field]: value }));
    try {
      const res = await fetch('/api/update/asset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, [field]: value }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch (e) {
      setData((d) => ({ ...d, [field]: prev }));
    }
  }

  function inlineText(field, { numeric = false, placeholder = '—', display, className = '', inputClassName = '' } = {}) {
    if (editing === field) {
      return (
        <input
          autoFocus
          type={numeric ? 'number' : 'text'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') { skipBlurRef.current = true; cancelEdit(); }
          }}
          onBlur={() => {
            if (skipBlurRef.current) { skipBlurRef.current = false; return; }
            saveEdit(field, { numeric });
          }}
          className={`w-full px-2 py-1 bg-gray-900 border border-indigo-500 rounded text-white outline-none ${inputClassName || 'text-sm'}`}
        />
      );
    }
    const val = data[field];
    const shown = display ? display(val) : (val != null && val !== '' ? val : null);
    return (
      <span
        onClick={() => startEdit(field, val)}
        className={`cursor-text hover:bg-gray-800/60 rounded px-1 -mx-1 transition-colors ${className}`}
        title="Click to edit"
      >
        {shown != null ? shown : <span className="text-gray-600 italic">{placeholder}</span>}
      </span>
    );
  }

  function statCard(label, field, { color, prefix = '', display } = {}) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-xl font-bold truncate ${color}`}>
          {inlineText(field, {
            numeric: true,
            placeholder: '—',
            display: display || ((v) => (v != null && v !== '' ? `${prefix}${Number(v).toLocaleString()}` : null)),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Top bar: back + actions */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm font-medium">
          ← Database
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">{saving ? 'Saving…' : ''}</span>
          <button
            onClick={() => savePlain('watched', !data.watched)}
            className={`text-xl leading-none transition-colors ${data.watched ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-amber-400'}`}
            title={data.watched ? 'Unfavorite' : 'Favorite'}
          >
            {data.watched ? '★' : '☆'}
          </button>
          <button
            onClick={onShowMap}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            ◗ Show on map
          </button>
        </div>
      </div>

      {/* Image banner */}
      {propertyImage && (
        <img
          src={propertyImage}
          alt="Property"
          className="w-full h-56 object-cover rounded-xl border border-gray-800 mb-5"
          onError={() => setPropertyImage(null)}
        />
      )}

      {/* Name + badges */}
      <h1 className="text-3xl font-bold text-white leading-tight mb-2">
        {inlineText('name', { placeholder: 'Unnamed asset', inputClassName: 'text-2xl font-bold' })}
      </h1>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <select
          value={data.status || 'scouting'}
          onChange={(e) => savePlain('status', e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-sm text-gray-200 outline-none focus:border-indigo-500 cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        {marketsIn.map((m) => (
          <span key={m.id} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-300 border border-gray-700">▢ {m.name}</span>
        ))}
        {regions.map((r) => (
          <span
            key={r.id}
            className="px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{ color: r.color, borderColor: `${r.color}55`, backgroundColor: `${r.color}1a` }}
          >
            ◆ {r.name}
          </span>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCard('Rating', 'rating', { color: 'text-amber-400', display: (v) => (v != null && v !== '' ? `${Number(v)} / 10` : null) })}
        {statCard('Est. Value', 'estimated_value', { color: 'text-indigo-400', prefix: '$' })}
        {statCard('Asking Price', 'asking_price', { color: 'text-emerald-400', prefix: '$' })}
        {statCard('Units', 'units', { color: 'text-gray-200' })}
      </div>

      {/* Address + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Address</p>
          <div className="text-sm text-gray-200">
            {inlineText('address', { placeholder: 'Add an address' })}
          </div>
          {data.address && (
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-1.5 inline-block">
              Open in Google Maps
            </a>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Property Type</p>
          <div className="text-sm text-gray-200">
            {inlineText('property_type', { placeholder: 'Add type' })}
          </div>
          {data.created_at && (
            <p className="text-xs text-gray-600 mt-1.5">Added {new Date(data.created_at).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-8">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Notes</p>
        {editing === 'notes' ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { skipBlurRef.current = true; cancelEdit(); } }}
            onBlur={() => {
              if (skipBlurRef.current) { skipBlurRef.current = false; return; }
              saveEdit('notes');
            }}
            rows={8}
            className="w-full px-4 py-3 bg-gray-900 border border-indigo-500 rounded-xl text-sm text-gray-100 outline-none resize-none leading-relaxed"
          />
        ) : (
          <div
            onClick={() => startEdit('notes', data.notes)}
            className="text-sm text-gray-300 p-4 bg-gray-900 rounded-xl border border-gray-800 cursor-text hover:border-gray-700 transition-colors min-h-[6rem] whitespace-pre-wrap leading-relaxed"
            title="Click to edit"
          >
            {data.notes || <span className="text-gray-600 italic">Click to add notes…</span>}
          </div>
        )}
      </div>
    </div>
  );
}
