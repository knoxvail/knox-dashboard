'use client';

import { useState } from 'react';
import { parseCSV, mapCostarToComp, validateComp } from '@/lib/utils/csvParser';
import { addComp } from '@/lib/store/compStore';
import { loadMarkets } from '@/lib/store/marketStore';

export default function CSVImportModal({ onClose }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [markets, setMarkets] = useState([]);
  const [errors, setErrors] = useState([]);
  const [step, setStep] = useState('input');

  useState(() => {
    setMarkets(loadMarkets());
    if (loadMarkets().length > 0) {
      setSelectedMarket(loadMarkets()[0].id);
    }
  }, []);

  function handlePreview() {
    if (!csvText.trim()) {
      alert('Please paste CSV data');
      return;
    }

    const { rows } = parseCSV(csvText);
    if (rows.length === 0) {
      alert('No data rows found in CSV');
      return;
    }

    const mapped = rows.slice(0, 10).map(row => {
      const comp = mapCostarToComp(row);
      const isSold = comp.comp_type === 'sold';
      const validation = validateComp(comp, isSold);
      return { comp, validation };
    });

    const hasErrors = mapped.some(m => !m.validation.isValid);
    if (hasErrors) {
      setErrors(mapped.filter(m => !m.validation.isValid).map(m => ({
        address: m.comp.address,
        errors: m.validation.errors,
      })));
    }

    setPreview(mapped);
    setStep('review');
  }

  function handleImport() {
    const { rows } = parseCSV(csvText);
    const isSold = rows[0] ? rows[0].comp_type === 'sold' : true;

    let imported = 0;
    rows.forEach(row => {
      const comp = {
        ...mapCostarToComp(row),
        market_id: selectedMarket,
      };
      const validation = validateComp(comp, isSold);

      if (validation.isValid) {
        addComp(comp);
        imported++;
      }
    });

    alert(`Imported ${imported} comps successfully`);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-gray-950 border border-gray-800 rounded shadow-lg w-full max-w-3xl p-6 max-h-96 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4 text-white">Import Comps from CSV</h2>

          {step === 'input' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-300 mb-2">
                  Select Market
                </label>
                <select
                  value={selectedMarket}
                  onChange={(e) => setSelectedMarket(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100"
                >
                  {markets.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-300 mb-2">
                  Paste CSV (CoStar/Trepp format)
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-900 rounded text-sm text-gray-100 font-mono"
                  rows="6"
                  placeholder="address,sale date,sale price,price per sf,..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-700 bg-gray-900 text-gray-300 rounded text-sm font-mono hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
                >
                  Preview
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-300">Preview first 10 rows:</p>

              {errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-800 p-3 rounded text-sm">
                  <p className="text-red-300 font-bold mb-2">⚠️ Errors found in {errors.length} row(s):</p>
                  {errors.slice(0, 3).map((err, i) => (
                    <div key={i} className="text-red-400 text-xs mb-1">
                      {err.address}: {err.errors.join(', ')}
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-2 py-1 text-gray-400">Address</th>
                      <th className="text-left px-2 py-1 text-gray-400">Type</th>
                      <th className="text-right px-2 py-1 text-gray-400">Price</th>
                      <th className="text-right px-2 py-1 text-gray-400">Price/SF</th>
                      <th className="text-left px-2 py-1 text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-900">
                        <td className="px-2 py-1 text-gray-300">{item.comp.address}</td>
                        <td className="px-2 py-1 text-gray-300 font-mono">{item.comp.comp_type}</td>
                        <td className="px-2 py-1 text-right text-gray-300">{item.comp.sale_price ? `$${item.comp.sale_price}` : '—'}</td>
                        <td className="px-2 py-1 text-right text-gray-300">{item.comp.price_per_sf || '—'}</td>
                        <td className="px-2 py-1">
                          {item.validation.isValid ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-red-400">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="flex-1 px-4 py-2 border border-gray-700 bg-gray-900 text-gray-300 rounded text-sm font-mono hover:bg-gray-800"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-mono hover:bg-blue-700"
                >
                  Import All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
