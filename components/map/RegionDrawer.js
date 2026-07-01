'use client';

import { useRef, useState } from 'react';
import { updateDrawing, deleteDrawing } from '@/lib/store/drawingStore';
import { getRegionsForPoint } from '@/lib/utils/geo';

export default function RegionDrawer({ region, assets = [], onClose, onUpdated, onDeleted, onAssetSelect, onMinimize, onRedraw }) {
  const [data, setData] = useState(region);
  const [editing, setEditing] = useState(null); // 'name' | 'description'
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const skipBlurRef = useRef(false);

  const isMarket = data.kind === 'market';
  const kindLabel = isMarket ? 'market' : 'region';

  // Assets whose coordinates fall inside this drawing's polygon
  const assetsInside = assets.filter((a) => getRegionsForPoint(a, [data]).length > 0);

  function startEdit(field) {
    setEditing(field);
    setDraft(field === 'name' ? data.name || '' : data.description || '');
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  async function saveField(field) {
    let value = draft.trim();
    if (field === 'name') {
      if (!value) { cancelEdit(); return; } // name can't be blank
    } else {
      value = value || null;
    }
    const prev = data[field];
    setData((d) => ({ ...d, [field]: value }));
    setEditing(null);
    setDraft('');
    setIsSaving(true);
    try {
      const updated = await updateDrawing(data.id, { [field]: value });
      onUpdated?.(updated || { ...data, [field]: value });
    } catch (error) {
      console.error('Failed to save region', field, error);
      setData((d) => ({ ...d, [field]: prev })); // revert on error
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${isMarket ? 'market' : 'region'} "${data.name}"? This cannot be undone.`)) return;
    await deleteDrawing(data.id);
    onDeleted?.(data.id);
  }

  return (
    <div className="absolute left-4 top-28 bottom-4 w-72 z-40 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-slide-left" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center shrink-0 bg-gray-900/95 backdrop-blur">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors duration-200 text-sm font-medium"
          title="Back"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{isSaving ? 'Saving…' : (isMarket ? 'Market' : 'Region')}</span>
          <button
            onClick={onMinimize}
            className="text-gray-400 hover:text-gray-200 transition-colors text-lg leading-none px-1"
            title="Minimize"
          >
            —
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name (click to edit) */}
        {editing === 'name' ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') { skipBlurRef.current = true; cancelEdit(); }
            }}
            onBlur={() => {
              if (skipBlurRef.current) { skipBlurRef.current = false; return; }
              saveField('name');
            }}
            className="w-full px-2 py-1 bg-gray-900 border border-indigo-500 rounded text-2xl font-bold text-white outline-none"
          />
        ) : (
          <h1
            onClick={() => startEdit('name')}
            className="text-2xl font-bold text-white leading-tight cursor-text hover:bg-gray-800/60 rounded px-1 -mx-1 transition-colors"
            title="Click to edit"
          >
            {data.name}
          </h1>
        )}

        {/* Description (click to edit / add) */}
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Description</p>
          {editing === 'description' ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { skipBlurRef.current = true; cancelEdit(); }
              }}
              onBlur={() => {
                if (skipBlurRef.current) { skipBlurRef.current = false; return; }
                saveField('description');
              }}
              rows={4}
              placeholder="Add a description…"
              className="w-full px-3 py-2 bg-gray-900 border border-indigo-500 rounded-lg text-sm text-gray-100 outline-none resize-none"
            />
          ) : (
            <div
              onClick={() => startEdit('description')}
              className="text-sm p-3 bg-gray-800/50 rounded-lg border border-gray-800 cursor-text hover:border-gray-700 transition-colors min-h-[3rem]"
              title="Click to edit"
            >
              {data.description ? (
                <span className="text-gray-300">{data.description}</span>
              ) : (
                <span className="text-indigo-400/80">+ Click to add a description…</span>
              )}
            </div>
          )}
        </div>

        {/* Assets inside this region */}
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
            Assets in this {kindLabel} ({assetsInside.length})
          </p>
          {assetsInside.length > 0 ? (
            <div className="space-y-2">
              {assetsInside.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onAssetSelect?.(a)}
                  className="w-full text-left p-3 bg-gray-800/40 hover:bg-gray-800 rounded-lg border border-gray-800 hover:border-indigo-600/40 transition-colors"
                >
                  <p className="text-sm text-gray-200 font-medium">{a.name || a.address}</p>
                  <p className="text-xs text-gray-500">{a.address}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-gray-800/20 rounded-lg border border-gray-800">
              <p className="text-sm text-gray-500">No assets fall inside this {kindLabel} yet.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-800 space-y-2">
          <button
            onClick={() => onRedraw?.()}
            className="w-full px-4 py-2.5 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-600/30 rounded-lg text-sm font-semibold transition-colors"
          >
            ✎ Redraw shape
          </button>
          <p className="text-xs text-gray-600">Re-outline the {kindLabel} — name, description, and color are kept.</p>
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg text-sm font-semibold transition-colors mt-2"
          >
            Delete {kindLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
