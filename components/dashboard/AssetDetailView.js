'use client';

export default function AssetDetailView({ assets, marketNames }) {
  if (!assets || assets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No assets selected</p>
      </div>
    );
  }

  const STATUS_LABELS = {
    scouting: 'Scouting',
    interested: 'Interested',
    active: 'Active',
    passed: 'Passed',
    closed: 'Closed',
  };

  return (
    <div className="p-6">
      {/* Single Asset */}
      {assets.length === 1 ? (
        <div className="max-w-4xl">
          <SingleAssetDetail
            asset={assets[0]}
            marketName={marketNames[assets[0].id]}
            statusLabels={STATUS_LABELS}
          />
        </div>
      ) : (
        /* Comparison View */
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Compare Assets</h2>
          <div className="grid grid-cols-2 gap-6">
            {assets.map((asset) => (
              <div key={asset.id} className="border border-gray-800 rounded-lg p-4">
                <SingleAssetDetail
                  asset={asset}
                  marketName={marketNames[asset.id]}
                  statusLabels={STATUS_LABELS}
                  compact={true}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleAssetDetail({ asset, marketName, statusLabels, compact = false }) {
  return (
    <div className={!compact ? 'bg-gray-900 border border-gray-800 rounded-2xl p-8' : ''}>
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-800">
        <h1 className={!compact ? 'text-3xl font-bold text-white' : 'text-xl font-bold text-white'}>
          {asset.name || asset.address}
        </h1>
        <p className="text-sm text-gray-400 mt-2">{marketName}</p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <DetailItem label="Status" value={statusLabels[asset.status] || asset.status} />
        <DetailItem label="Asset Class" value={asset.asset_class || '—'} />
        <DetailItem label="Units" value={asset.units ? asset.units.toLocaleString() : '—'} />
        <DetailItem label="Purchase Price" value={asset.purchase_price ? `$${asset.purchase_price.toLocaleString()}` : '—'} />
        <DetailItem label="Cap Rate" value={asset.cap_rate ? `${(asset.cap_rate * 100).toFixed(2)}%` : '—'} />
        <DetailItem label="NOI" value={asset.noi ? `$${asset.noi.toLocaleString()}` : '—'} />
        <DetailItem label="Score" value={asset.score ? asset.score.toFixed(1) : '—'} />
        <DetailItem label="Location" value={asset.latitude && asset.longitude ? `${asset.latitude.toFixed(4)}, ${asset.longitude.toFixed(4)}` : '—'} />
      </div>

      {/* Notes */}
      {asset.notes && (
        <div className="pt-6 border-t border-gray-800">
          <h3 className="text-sm font-bold text-gray-300 uppercase mb-3">Notes</h3>
          <p className="text-gray-400 leading-relaxed">{asset.notes}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="mt-8 pt-6 border-t border-gray-800">
        <p className="text-xs text-gray-600 font-mono">
          {asset.created_at && `Created: ${new Date(asset.created_at).toLocaleDateString()}`}
        </p>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase mb-1">{label}</p>
      <p className="text-sm font-mono text-gray-300">{value}</p>
    </div>
  );
}
