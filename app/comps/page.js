'use client';

import { useEffect, useState } from 'react';
import { loadComps, deleteComp } from '@/lib/store/compStore';
import { loadMarkets } from '@/lib/store/marketStore';
import AddCompForm from '@/components/forms/AddCompForm';
import CSVImportModal from '@/components/forms/CSVImportModal';

const COMP_TYPE_LABELS = {
  sold: 'Sold',
  lease: 'Lease',
};

export default function CompsPage() {
  const [comps, setComps] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    loadAndDisplay();
  }, []);

  function loadAndDisplay() {
    setComps(loadComps());
    setMarkets(loadMarkets());
  }

  function handleDelete(id) {
    if (confirm('Delete this comp?')) {
      deleteComp(id);
      loadAndDisplay();
    }
  }

  const filteredComps = comps
    .filter(c => filterType === 'all' || c.comp_type === filterType)
    .filter(c => filterMarket === 'all' || c.market_id === filterMarket)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date) - new Date(a.date);
        case 'price':
          return (b.sale_price || 0) - (a.sale_price || 0);
        case 'rent':
          return (b.rent_per_sf || 0) - (a.rent_per_sf || 0);
        default:
          return 0;
      }
    });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Comps</h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
          >
            + Add Comp
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-mono hover:bg-gray-600"
          >
            📤 Import CSV
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-100 rounded text-sm px-3 py-2"
          >
            <option value="all">All Types</option>
            <option value="sold">Sold</option>
            <option value="lease">Lease</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Market</label>
          <select
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-100 rounded text-sm px-3 py-2"
          >
            <option value="all">All Markets</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-100 rounded text-sm px-3 py-2"
          >
            <option value="date">Date</option>
            <option value="price">Sale Price</option>
            <option value="rent">Rent/SF</option>
          </select>
        </div>
      </div>

      {filteredComps.length === 0 ? (
        <p className="text-gray-400">No comps yet. Add one manually or import from CSV.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2 font-mono text-gray-400">Address</th>
                <th className="text-left px-4 py-2 font-mono text-gray-400">Type</th>
                <th className="text-left px-4 py-2 font-mono text-gray-400">Date</th>
                <th className="text-right px-4 py-2 font-mono text-gray-400">Sale Price</th>
                <th className="text-right px-4 py-2 font-mono text-gray-400">Price/SF</th>
                <th className="text-right px-4 py-2 font-mono text-gray-400">Cap Rate</th>
                <th className="text-right px-4 py-2 font-mono text-gray-400">Rent/SF</th>
                <th className="text-right px-4 py-2 font-mono text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComps.map(comp => (
                <tr key={comp.id} className="border-b border-gray-800 hover:bg-gray-900">
                  <td className="px-4 py-3 text-gray-100">{comp.address}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono">{COMP_TYPE_LABELS[comp.comp_type]}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono">{new Date(comp.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {comp.sale_price ? `$${comp.sale_price.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {comp.price_per_sf ? `$${comp.price_per_sf.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {comp.cap_rate ? `${(comp.cap_rate * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {comp.rent_per_sf ? `$${comp.rent_per_sf.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddForm && (
        <AddCompForm
          markets={markets}
          onClose={() => {
            setShowAddForm(false);
            loadAndDisplay();
          }}
        />
      )}

      {showImport && (
        <CSVImportModal
          onClose={() => {
            setShowImport(false);
            loadAndDisplay();
          }}
        />
      )}
    </div>
  );
}
