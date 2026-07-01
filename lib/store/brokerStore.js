import { supabase } from '../supabase';

// Brokers live in Supabase (table: brokers), linked to a region by a
// free-text region name so they never break if a drawn region is renamed
// or deleted. Falls back to a localStorage cache if Supabase is unreachable.

const BROKERS_KEY = 'cre_brokers';
let cache = null;

function getLocal() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BROKERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setLocal(brokers) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BROKERS_KEY, JSON.stringify(brokers));
}

export async function loadBrokers() {
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    cache = data || [];
    setLocal(cache);
    return cache;
  } catch (error) {
    console.error('Error loading brokers from Supabase, using local cache:', error);
    cache = getLocal();
    return cache;
  }
}

export async function addBroker(broker) {
  const entry = {
    name: broker.name || '',
    title: broker.title || null,
    firm: broker.firm || null,
    address: broker.address || null,
    phone: broker.phone || null,
    phone2: broker.phone2 || null,
    email: broker.email || null,
    website: broker.website || null,
    region: (broker.region || '').trim() || null,
    notes: broker.notes || null,
    favorited: broker.favorited || false,
  };
  try {
    const { data, error } = await supabase.from('brokers').insert([entry]).select().single();
    if (error) throw error;
    cache = [data, ...(cache || getLocal())];
    setLocal(cache);
    return data;
  } catch (error) {
    console.error('Error adding broker to Supabase, saving locally:', error);
    const local = { id: `local-${Date.now()}`, created_at: new Date().toISOString(), ...entry };
    cache = [local, ...(cache || getLocal())];
    setLocal(cache);
    return local;
  }
}

export async function updateBroker(id, updates) {
  try {
    const { data, error } = await supabase.from('brokers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    cache = (cache || getLocal()).map((b) => (b.id === id ? data : b));
    setLocal(cache);
    return data;
  } catch (error) {
    console.error('Error updating broker in Supabase, updating locally:', error);
    cache = (cache || getLocal()).map((b) => (b.id === id ? { ...b, ...updates } : b));
    setLocal(cache);
    return cache.find((b) => b.id === id);
  }
}

export async function deleteBroker(id) {
  try {
    const { error } = await supabase.from('brokers').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting broker from Supabase:', error);
  } finally {
    cache = (cache || getLocal()).filter((b) => b.id !== id);
    setLocal(cache);
  }
}
