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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-96 overflow-y-auto animate-scale-in">
          <h2 className="text-lg font-semibold mb-5 text-white">Add Comp</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Market *</label>
                <select
                  value={formData.market_id}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, market_id: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                >
                  {markets.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
                <select
                  value={compType}
                  onChange={(e) => {
                    setCompType(e.target.value);
                    setFormData(prev => ({ ...prev, comp_type: e.target.value }));
                  }}
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                >
                  <option value="sold">Sold</option>
                  <option value="lease">Lease</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                />
              </div>
            </div>

            {compType === 'sold' ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sale Price</label>
                  <input
                    type="number"
                    value={formData.sale_price}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, sale_price: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Price/SF</label>
                  <input
                    type="number"
                    value={formData.price_per_sf}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, price_per_sf: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cap Rate %</label>
                  <input
                    type="number"
                    value={formData.cap_rate}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, cap_rate: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                    step="0.01"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rent/SF</label>
                  <input
                    type="number"
                    value={formData.rent_per_sf}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, rent_per_sf: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Vacancy %</label>
                  <input
                    type="number"
                    value={formData.vacancy_rate}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, vacancy_rate: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                    step="0.01"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
                rows="2"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors duration-200"
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
