import { supabase } from '../supabase';

const MARKETS_KEY = 'cre_markets';
let marketsCache = null;

// Fallback to localStorage for offline support
function getLocalMarkets() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MARKETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function setLocalMarkets(markets) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MARKETS_KEY, JSON.stringify(markets));
}

export async function loadMarkets() {
  try {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    marketsCache = data || [];
    setLocalMarkets(marketsCache);
    return marketsCache;
  } catch (error) {
    console.error('Error loading markets from Supabase:', error);
    // Fallback to localStorage
    const cached = getLocalMarkets();
    marketsCache = cached;
    return cached;
  }
}

export async function saveMarkets(markets) {
  // Update localStorage cache
  setLocalMarkets(markets);
  marketsCache = markets;
}

export async function addMarket(market) {
  const newMarket = {
    name: market.name,
    address: market.address,
    lat: market.lat,
    lng: market.lng,
    created_at: new Date().toISOString(),
    created_by: 'user',
  };

  try {
    const { data, error } = await supabase
      .from('markets')
      .insert([newMarket])
      .select()
      .single();

    if (error) throw error;

    // Update cache
    const updated = [...(marketsCache || []), data];
    await saveMarkets(updated);
    return data;
  } catch (error) {
    console.error('Error adding market:', error);
    // Fallback: create with local ID
    const localId = Date.now().toString();
    const localMarket = { id: localId, ...newMarket };
    const updated = [...(marketsCache || []), localMarket];
    await saveMarkets(updated);
    return localMarket;
  }
}

export async function updateMarket(id, updates) {
  try {
    const { data, error } = await supabase
      .from('markets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update cache
    const markets = marketsCache || [];
    const index = markets.findIndex(m => m.id === id);
    if (index !== -1) {
      markets[index] = data;
      await saveMarkets(markets);
    }
    return data;
  } catch (error) {
    console.error('Error updating market:', error);
    return null;
  }
}

export async function deleteMarket(id) {
  try {
    const { error } = await supabase
      .from('markets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Update cache
    const markets = (marketsCache || []).filter(m => m.id !== id);
    await saveMarkets(markets);
  } catch (error) {
    console.error('Error deleting market:', error);
  }
}

export async function getMarketById(id) {
  try {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching market:', error);
    // Fallback to cache
    const markets = marketsCache || [];
    return markets.find(m => m.id === id);
  }
}
