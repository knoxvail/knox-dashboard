const ASSETS_KEY = 'cre_assets';

export function loadAssets() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ASSETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveAssets(assets) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
}

export function addAsset(asset) {
  const assets = loadAssets();
  const newAsset = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    watched: false,
    ...asset,
  };
  assets.push(newAsset);
  saveAssets(assets);
  return newAsset;
}

export function updateAsset(id, updates) {
  const assets = loadAssets();
  const index = assets.findIndex(a => a.id === id);
  if (index !== -1) {
    assets[index] = { ...assets[index], ...updates };
    saveAssets(assets);
    return assets[index];
  }
  return null;
}

export function deleteAsset(id) {
  const assets = loadAssets();
  const filtered = assets.filter(a => a.id !== id);
  saveAssets(filtered);
}

export function getAssetById(id) {
  const assets = loadAssets();
  return assets.find(a => a.id === id);
}

export function getWatchlist() {
  const assets = loadAssets();
  return assets.filter(a => a.watched);
}

export function getAssetsByMarket(marketId) {
  const assets = loadAssets();
  return assets.filter(a => a.market_id === marketId);
}

export function toggleWatched(id) {
  const assets = loadAssets();
  const index = assets.findIndex(a => a.id === id);
  if (index !== -1) {
    assets[index].watched = !assets[index].watched;
    saveAssets(assets);
    return assets[index];
  }
  return null;
}
