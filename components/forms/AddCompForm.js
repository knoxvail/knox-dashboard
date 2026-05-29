'use client';

import { useState } from 'react';
import { addComp } from '@/lib/store/compStore';

export default function AddCompForm({ markets, onClose }) {
  const [compType, setCompType] = useState('sold');
  const [formData, setFormData] = useState({
    market_id: markets[0]?.id || '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    source: 'manual',
    comp_type: 'sold',
    sale_price: '',
    price_per_sf: '',
    cap_rate: '',
    noi: '',
    sf: '',
    units: '',
    rent_per_sf: '',
    vacancy_rate: '',
    lease_term: '',
    concessions: '',
    notes: '',
  });

  function handleSubmit(e) {
    e.preventDefault();

    if (!formData.address || !formData.date || !formData.market_id) {
      alert('Please fill in required fields');
      return;
    }

    const compData = {
      ...formData,
      comp_type: compType,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      price_per_sf: formData.price_per_sf ? parseFloat(formData.price_per_sf) : null,
      cap_rate: formData.cap_rate ? parseFloat(formData.cap_rate) / 100 : null,
      noi: formData.noi ? parseFloat(formData.noi) : null,
      sf: formData.sf ? parseFloat(formData.sf) : null,
      units: formData.units ? parseFloat(formData.units) : null,
      rent_per_sf: formData.rent_per_sf ? parseFloat(formData.rent_per_sf) : null,
      vacancy_rate: formData.vacancy_rate ? parseFloat(formData.vacancy_rate) / 100 : null,
    };

    addComp(compData);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-gray-950 border border-gray-800 rounded shadow-lg w-full max-w-2xl p-6 max-h-96 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4 text-white">Add Comp</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">Market *</label>
                <select
                  value={formData.market_id}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, market_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                >
                  {markets.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">Type *</label>
                <select
                  value={compType}
                  onChange={(e) => {
                    setCompType(e.target.value);
                    setFormData(prev => ({ ...prev, comp_type: e.target.value }));
                  }}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                >
                  <option value="sold">Sold</option>
                  <option value="lease">Lease</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                />
              </div>
            </div>

            {compType === 'sold' ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-mono text-gray-300 mb-1">Sale Price</label>
                  <input
                    type="number"
                    value={formData.sale_price}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, sale_price: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-mono text-gray-300 mb-1">Price/SF</label>
                  <input
                    type="number"
                    value={formData.price_per_sf}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, price_per_sf: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-mono text-gray-300 mb-1">Cap Rate %</label>
                  <input
                    type="number"
                    value={formData.cap_rate}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, cap_rate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                    step="0.01"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-mono text-gray-300 mb-1">Rent/SF</label>
                  <input
                    type="number"
                    value={formData.rent_per_sf}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, rent_per_sf: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-mono text-gray-300 mb-1">Vacancy %</label>
                  <input
                    type="number"
                    value={formData.vacancy_rate}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, vacancy_rate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                    step="0.01"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-mono text-gray-300 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                rows="2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-700 bg-gray-900 text-gray-300 rounded text-sm font-mono hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
              >
                Save Comp
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
