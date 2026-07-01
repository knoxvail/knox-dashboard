'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadBrokers, addBroker, updateBroker, deleteBroker } from '@/lib/store/brokerStore';
import { loadDrawings } from '@/lib/store/drawingStore';

const EMPTY = { name: '', title: '', firm: '', address: '', phone: '', phone2: '', email: '', website: '', region: '', notes: '' };

export default function BrokersView() {
  const [brokers, setBrokers] = useState([]);
  const [regionNames, setRegionNames] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // broker id being edited
  const [editDraft, setEditDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBrokers(await loadBrokers());
  }

  useEffect(() => {
    refresh();
    loadDrawings().then((drawings) => {
      const names = (drawings || [])
        .filter((d) => d.kind !== 'market') // regions only
        .map((d) => d.name)
        .filter(Boolean);
      setRegionNames([...new Set(names)].sort((a, b) => a.localeCompare(b)));
    });
  }, []);

  // Group brokers by region (Unassigned last)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const b of brokers) {
      const key = b.region && b.region.trim() ? b.region.trim() : '— Unassigned —';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    // favorited brokers float to the top of each region
    for (const list of map.values()) {
      list.sort((a, b) => (b.favorited ? 1 : 0) - (a.favorited ? 1 : 0) || (a.name || '').localeCompare(b.name || ''));
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0].startsWith('—')) return 1;
      if (b[0].startsWith('—')) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [brokers]);

  const regionSuggestions = useMemo(() => {
    const used = brokers.map((b) => b.region).filter(Boolean);
    return [...new Set([...regionNames, ...used])].sort((a, b) => a.localeCompare(b));
  }, [regionNames, brokers]);

  async function handleAdd() {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    await addBroker(form);
    await refresh();
    setForm(EMPTY);
    setAdding(false);
    setBusy(false);
  }

  function startEdit(b) {
    setEditing(b.id);
    setEditDraft({
      name: b.name || '', title: b.title || '', firm: b.firm || '', address: b.address || '',
      phone: b.phone || '', phone2: b.phone2 || '', email: b.email || '', website: b.website || '',
      region: b.region || '', notes: b.notes || '',
    });
  }

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    await updateBroker(editing, editDraft);
    await refresh();
    setEditing(null);
    setBusy(false);
  }

  async function remove(id) {
    if (!confirm('Delete this broker?')) return;
    await deleteBroker(id);
    await refresh();
    if (editing === id) setEditing(null);
  }

  async function toggleFav(b) {
    // optimistic
    setBrokers((prev) => prev.map((x) => (x.id === b.id ? { ...x, favorited: !b.favorited } : x)));
    await updateBroker(b.id, { favorited: !b.favorited });
    await refresh();
  }

  const inputCls = 'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 outline-none focus:border-indigo-500';

  function fieldSet(value, setValue) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Broker name *" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} />
        <input className={inputCls} placeholder="Title (e.g. Principal)" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
        <input className={inputCls} placeholder="Firm / brokerage" value={value.firm} onChange={(e) => setValue({ ...value, firm: e.target.value })} />
        <input className={inputCls} placeholder="Region (e.g. Colorado Springs)" value={value.region} list="broker-regions" onChange={(e) => setValue({ ...value, region: e.target.value })} />
        <input className={inputCls} placeholder="Phone" value={value.phone} onChange={(e) => setValue({ ...value, phone: e.target.value })} />
        <input className={inputCls} placeholder="Phone (alt)" value={value.phone2} onChange={(e) => setValue({ ...value, phone2: e.target.value })} />
        <input className={inputCls} placeholder="Email" value={value.email} onChange={(e) => setValue({ ...value, email: e.target.value })} />
        <input className={inputCls} placeholder="Website" value={value.website} onChange={(e) => setValue({ ...value, website: e.target.value })} />
        <input className={`${inputCls} sm:col-span-2`} placeholder="Address" value={value.address} onChange={(e) => setValue({ ...value, address: e.target.value })} />
        <textarea className={`${inputCls} sm:col-span-2 resize-none`} rows={2} placeholder="Notes" value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} />
      </div>
    );
  }

  function websiteHref(w) {
    if (!w) return null;
    return w.startsWith('http') ? w : `https://${w}`;
  }

  return (
    <div>
      <datalist id="broker-regions">
        {regionSuggestions.map((r) => <option key={r} value={r} />)}
      </datalist>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{brokers.length} broker{brokers.length === 1 ? '' : 's'} across {grouped.length} region{grouped.length === 1 ? '' : 's'}</p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
            + Add broker
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-6 bg-gray-900 border border-indigo-500/40 rounded-xl p-4 space-y-3">
          {fieldSet(form, setForm)}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm(EMPTY); }} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleAdd} disabled={!form.name.trim() || busy} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold">{busy ? 'Saving…' : 'Save broker'}</button>
          </div>
        </div>
      )}

      {brokers.length === 0 && !adding && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg">No brokers yet.</p>
          <p className="text-sm mt-1">Add brokers and group them by the region they cover.</p>
        </div>
      )}

      <div className="space-y-7">
        {grouped.map(([region, list]) => (
          <div key={region}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-indigo-400">◆</span>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{region}</h2>
              <span className="text-xs text-gray-600">({list.length})</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {list.map((b) => (
                editing === b.id ? (
                  <div key={b.id} className="lg:col-span-2 bg-gray-900 border border-indigo-500/40 rounded-xl p-4 space-y-3">
                    {fieldSet(editDraft, setEditDraft)}
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => remove(b.id)} className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 mr-auto">Delete</button>
                      <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
                      <button onClick={saveEdit} disabled={busy} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold">{busy ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                ) : (
                  <div key={b.id} className="group bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex items-start justify-between gap-3 transition-colors">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{b.name || <span className="text-gray-600 italic">Unnamed</span>}</p>
                      {(b.title || b.firm) && (
                        <p className="text-sm text-gray-400 truncate">{[b.title, b.firm].filter(Boolean).join(' · ')}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-sm">
                        {b.phone && <a href={`tel:${b.phone}`} className="text-indigo-400 hover:text-indigo-300">{b.phone}</a>}
                        {b.phone2 && <a href={`tel:${b.phone2}`} className="text-indigo-400/70 hover:text-indigo-300">{b.phone2}</a>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                        {b.email && <a href={`mailto:${b.email}`} className="text-indigo-400 hover:text-indigo-300 truncate">{b.email}</a>}
                        {b.website && <a href={websiteHref(b.website)} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 truncate">{b.website}</a>}
                      </div>
                      {b.address && <p className="text-xs text-gray-500 mt-1">{b.address}</p>}
                      {b.notes && <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{b.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleFav(b)}
                        className={`text-lg leading-none transition-colors ${b.favorited ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
                        title={b.favorited ? 'Unfavorite' : 'Favorite'}
                      >
                        {b.favorited ? '★' : '☆'}
                      </button>
                      <button onClick={() => startEdit(b)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white text-sm transition-opacity" title="Edit">✎</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
