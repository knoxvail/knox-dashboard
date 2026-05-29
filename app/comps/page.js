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

  async function loadAndDisplay() {
    setComps(loadComps());
    const marketsData = await loadMarkets();
    setMarkets(marketsData);
  }

  async function handleDelete(id) {
    if (confirm('Delete this comp?')) {
      deleteComp(id);
      await loadAndDisplay();
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
        <h1 className="text-3xl font-bold text-white">Comps</h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 shadow-md transition-all duration-200"
          >
            + Add Comp
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-all duration-200"
          >
            📤 Import CSV
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-900/50 border-b-2 border-gray-700 text-gray-100 rounded-lg text-sm px-3 py-2.5 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
          >
            <option value="all">All Types</option>
            <option value="sold">Sold</option>
            <option value="lease">Lease</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Market</label>
          <select
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
            className="bg-gray-900/50 border-b-2 border-gray-700 text-gray-100 rounded-lg text-sm px-3 py-2.5 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
          >
            <option value="all">All Markets</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-900/50 border-b-2 border-gray-700 text-gray-100 rounded-lg text-sm px-3 py-2.5 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950">
                <th className="text-left px-5 py-3 font-medium text-gray-300">Address</th>
                <th className="text-left px-5 py-3 font-medium text-gray-300">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-300">Date</th>
                <th className="text-right px-5 py-3 font-medium text-gray-300">Sale Price</th>
                <th className="text-right px-5 py-3 font-medium text-gray-300">Price/SF</th>
                <th className="text-right px-5 py-3 font-medium text-gray-300">Cap Rate</th>
                <th className="text-right px-5 py-3 font-medium text-gray-300">Rent/SF</th>
                <th className="text-right px-5 py-3 font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComps.map(comp => (
                <tr key={comp.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors duration-200">
                  <td className="px-5 py-3 text-gray-100 font-medium">{comp.address}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">{COMP_TYPE_LABELS[comp.comp_type]}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">{new Date(comp.date).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right text-gray-300 font-mono text-xs">
                    {comp.sale_price ? `$${comp.sale_price.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300 font-mono text-xs">
                    {comp.price_per_sf ? `$${comp.price_per_sf.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300 font-mono text-xs">
                    {comp.cap_rate ? `${(comp.cap_rate * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300 font-mono text-xs">
                    {comp.rent_per_sf ? `$${comp.rent_per_sf.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors duration-200"
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
