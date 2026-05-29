'use client';

import { useState, useEffect } from 'react';

export default function AssetDrawer({ asset, onClose }) {
  const [imageUrl, setImageUrl] = useState('');
  const [officialAddress, setOfficialAddress] = useState(asset?.address || '');

  useEffect(() => {
    // Get Google Images result
    if (asset?.address) {
      const encodedAddress = encodeURIComponent(asset.address);
      setImageUrl(`https://images.google.com/images?q=${encodedAddress}`);
    }

    // Try to reverse geocode to get official address
    if (asset?.lat && asset?.lng) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat: asset.lat, lng: asset.lng } },
        (results) => {
          if (results && results[0]) {
            setOfficialAddress(results[0].formatted_address);
          }
        }
      );
    }
  }, [asset]);

  if (!asset) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-900 border-l border-gray-800 shadow-lg z-50 overflow-y-auto flex flex-col animate-slide-right">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium"
          >
            ← Back
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors duration-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Image from Google */}
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Street View</p>
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-48 bg-gray-800/50 rounded-lg border border-gray-800 flex items-center justify-center hover:border-gray-700 transition-colors"
            >
              <span className="text-gray-400 text-sm font-medium">View on Google Images →</span>
            </a>
          </div>

          {/* Official Address */}
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Official Address</p>
            <p className="text-sm text-gray-300 font-medium mt-2">{officialAddress}</p>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Latitude</p>
              <p className="text-sm font-mono text-gray-300 font-semibold mt-1">{asset.lat?.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Longitude</p>
              <p className="text-sm font-mono text-gray-300 font-semibold mt-1">{asset.lng?.toFixed(6)}</p>
            </div>
          </div>

          {/* Property Type */}
          {asset.property_type && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Property Type</p>
              <p className="text-sm text-gray-300 font-medium mt-1">{asset.property_type}</p>
            </div>
          )}

          {/* Units */}
          {asset.units && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Units</p>
              <p className="text-sm font-mono text-gray-300 font-semibold mt-1">{asset.units}</p>
            </div>
          )}

          {/* Asking Price */}
          {asset.asking_price && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Asking Price</p>
              <p className="text-lg font-mono text-gray-300 font-semibold mt-1">${asset.asking_price.toLocaleString()}</p>
            </div>
          )}

          {/* Avg Rent */}
          {asset.avg_rent && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Average Rent</p>
              <p className="text-sm font-mono text-gray-300 font-semibold mt-1">${asset.avg_rent.toLocaleString()}</p>
            </div>
          )}

          {/* Notes */}
          {asset.notes && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Notes</p>
              <p className="text-sm text-gray-400 mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-800">{asset.notes}</p>
            </div>
          )}

          {/* Watchlist Status */}
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</p>
            <p className="text-sm text-gray-300 font-medium mt-1">{asset.watched ? '⭐ On Watchlist' : 'Not on Watchlist'}</p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 space-y-2">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
