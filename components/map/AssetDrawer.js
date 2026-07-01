'use client';

import { useEffect, useRef, useState } from 'react';

const STATUS_LABELS = {
  scouting: 'Scouting',
  active: 'Active',
  passed: 'Passed',
  closed: 'Closed',
};

const STATUS_OPTIONS = ['scouting', 'active', 'passed', 'closed'];

export default function AssetDrawer({ asset, onClose, onMinimize }) {
  const [propertyImage, setPropertyImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [data, setData] = useState(asset);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const skipBlurRef = useRef(false);

  const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(data.address || '')}`;

  useEffect(() => {
    const searchPropertyImage = async () => {
      try {
        const searchQuery = `${asset.name} ${asset.address}`;
        const response = await fetch(`/api/search/property-image?q=${encodeURIComponent(searchQuery)}`);
        const result = await response.json();
        if (result.imageUrl) setPropertyImage(result.imageUrl);
      } catch (error) {
        console.error('Error fetching property image:', error);
      } finally {
        setImageLoading(false);
      }
    };
    searchPropertyImage();
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

      // Editing the address re-aligns the pin
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
      setData((d) => ({ ...d, [field]: prev })); // revert on error
    } finally {
      setSaving(false);
    }
  }

  async function toggleWatch() {
    const next = !data.watched;
    const prev = data.watched;
    setData((d) => ({ ...d, watched: next }));
    try {
      const res = await fetch('/api/update/asset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, watched: next }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch (e) {
      setData((d) => ({ ...d, watched: prev }));
    }
  }

  async function saveStatus(value) {
    const prev = data.status;
    setData((d) => ({ ...d, status: value }));
    try {
      const res = await fetch('/api/update/asset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, status: value }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch (e) {
      setData((d) => ({ ...d, status: prev }));
    }
  }

  // Inline single-line editor (text or number)
  function inlineText(field, { numeric = false, placeholder = '—', display, className = '' } = {}) {
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
          className={`w-full px-2 py-1 bg-gray-900 border border-indigo-500 rounded text-sm text-white outline-none ${className}`}
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

  return (
    <div className="absolute left-4 top-28 bottom-4 w-72 z-40 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slide-left" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center shrink-0 bg-gray-900/95 backdrop-blur">
        <button onClick={onClose} className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors text-sm font-medium" title="Back">
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleWatch}
            className={`text-lg leading-none transition-colors ${data.watched ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-amber-400'}`}
            title={data.watched ? 'Unfavorite' : 'Favorite'}
          >
            {data.watched ? '★' : '☆'}
          </button>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{saving ? 'Saving…' : 'Asset'}</span>
          <button onClick={onMinimize} className="text-gray-400 hover:text-gray-200 transition-colors text-lg leading-none px-1" title="Minimize">—</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Property Image */}
        <div className="w-full bg-gray-800 border-b border-gray-800">
          {imageLoading ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Loading property image...</p>
            </div>
          ) : propertyImage ? (
            <img src={propertyImage} alt="Property" className="w-full h-40 object-cover" onError={() => setPropertyImage(null)} />
          ) : (
            <div className="p-3">
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent((data.name || '') + ' ' + (data.address || ''))}&tbm=isch`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors text-center"
              >
                View Photos on Google Images
              </a>
            </div>
          )}
        </div>

        <div className="p-4 space-y-5">
          {/* Name */}
          <h1 className="text-2xl font-bold text-white leading-tight">
            {inlineText('name', { placeholder: 'Unnamed asset' })}
          </h1>

          {/* Rating + Estimated Value */}
          <div className="space-y-3">
            <div className="min-w-0 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Rating</p>
              <p className="text-xl font-bold text-amber-400 truncate">
                {inlineText('rating', {
                  numeric: true,
                  placeholder: '— /10',
                  display: (v) => (v != null && v !== '' ? `${Number(v)} / 10` : null),
                })}
              </p>
            </div>
            <div className="min-w-0 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Est. Value</p>
              <p className="text-xl font-bold text-indigo-400 truncate" title="Estimated value">
                {inlineText('estimated_value', {
                  numeric: true,
                  placeholder: '—',
                  display: (v) => (v != null && v !== '' ? `$${Number(v).toLocaleString()}` : null),
                })}
              </p>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Address</p>
            <div className="text-sm text-gray-300">
              {inlineText('address', { placeholder: 'Add an address' })}
            </div>
            {data.address && (
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-1 inline-block">
                Open in Google Maps
              </a>
            )}
          </div>

          {/* Status + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Status</p>
              <select
                value={data.status || 'scouting'}
                onChange={(e) => saveStatus(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Type</p>
              <div className="text-sm text-gray-300">
                {inlineText('property_type', { placeholder: 'Add type' })}
              </div>
            </div>
          </div>

          {/* Units + Asking price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Units</p>
              <div className="text-sm text-gray-300">
                {inlineText('units', { numeric: true, placeholder: 'Add units' })}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Asking Price</p>
              <div className="text-sm text-gray-300">
                {inlineText('asking_price', {
                  numeric: true,
                  placeholder: 'Add price',
                  display: (v) => (v != null && v !== '' ? `$${Number(v).toLocaleString()}` : null),
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Notes</p>
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
                rows={4}
                className="w-full px-3 py-2 bg-gray-900 border border-indigo-500 rounded-lg text-sm text-gray-100 outline-none resize-none"
              />
            ) : (
              <div
                onClick={() => startEdit('notes', data.notes)}
                className="text-sm text-gray-400 p-3 bg-gray-800/50 rounded-lg border border-gray-800 cursor-text hover:border-gray-700 transition-colors min-h-[3rem]"
                title="Click to edit"
              >
                {data.notes || <span className="text-gray-600 italic">Click to add notes…</span>}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button onClick={onClose} className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-semibold transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
