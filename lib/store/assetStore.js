import { supabase } from '../supabase';

const ASSETS_KEY = 'cre_assets';
let assetsCache = null;

function getLocalAssets() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ASSETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function setLocalAssets(assets) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
}

export async function loadAssets() {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    assetsCache = data || [];
    setLocalAssets(assetsCache);
    return assetsCache;
  } catch (error) {
    console.error('Error loading assets from Supabase:', error);
    const cached = getLocalAssets();
    assetsCache = cached;
    return cached;
  }
}

export async function saveAssets(assets) {
  setLocalAssets(assets);
  assetsCache = assets;
}

export async function addAsset(asset) {
  const newAsset = {
    name: asset.name,
    address: asset.address,
    lat: asset.lat,
    lng: asset.lng,
    market_id: asset.market_id,
    status: asset.status || 'scouting',
    property_type: asset.property_type,
    units: asset.units,
    asking_price: asset.asking_price,
    avg_rent: asset.avg_rent,
    notes: asset.notes,
    watched: false,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('assets')
      .insert([newAsset])
      .select()
      .single();

    if (error) throw error;

    const updated = [...(assetsCache || []), data];
    await saveAssets(updated);
    return data;
  } catch (error) {
    console.error('Error adding asset:', error);
    const localId = Date.now().toString();
    const localAsset = { id: localId, ...newAsset };
    const updated = [...(assetsCache || []), localAsset];
    await saveAssets(updated);
    return localAsset;
  }
}

export async function updateAsset(id, updates) {
  try {
    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const assets = assetsCache || [];
    const index = assets.findIndex(a => a.id === id);
    if (index !== -1) {
      assets[index] = data;
      await saveAssets(assets);
    }
    return data;
  } catch (error) {
    console.error('Error updating asset:', error);
    return null;
  }
}

export async function deleteAsset(id) {
  try {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const assets = (assetsCache || []).filter(a => a.id !== id);
    await saveAssets(assets);
  } catch (error) {
    console.error('Error deleting asset:', error);
  }
}

export async function getAssetById(id) {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching asset:', error);
    const assets = assetsCache || [];
    return assets.find(a => a.id === id);
  }
}

export async function getWatchlist() {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('watched', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    const assets = assetsCache || [];
    return assets.filter(a => a.watched);
  }
}

export async function getAssetsByMarket(marketId) {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('market_id', marketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching assets by market:', error);
    const assets = assetsCache || [];
    return assets.filter(a => a.market_id === marketId);
  }
}

export async function toggleWatched(id) {
  try {
    const asset = assetsCache?.find(a => a.id === id) || await getAssetById(id);
    if (!asset) return null;

    const { data, error } = await supabase
      .from('assets')
      .update({ watched: !asset.watched })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const assets = assetsCache || [];
    const index = assets.findIndex(a => a.id === id);
    if (index !== -1) {
      assets[index] = data;
      await saveAssets(assets);
    }
    return data;
  } catch (error) {
    console.error('Error toggling watched:', error);
    return null;
  }
}
