import { supabase } from '../supabase';

let dealsCache = null;

export async function loadDeals() {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    dealsCache = data || [];
    return dealsCache;
  } catch (error) {
    console.error('Error loading deals from Supabase:', error);
    return [];
  }
}

export async function addDeal(dealData) {
  const newDeal = {
    name: dealData.name,
    stage: dealData.stage,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('deals')
      .insert([newDeal])
      .select()
      .single();

    if (error) throw error;

    // Update cache
    dealsCache = [...(dealsCache || []), data];
    return data;
  } catch (error) {
    console.error('Error adding deal:', error);
    throw error;
  }
}

export async function updateDeal(id, updates) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update cache
    const deals = dealsCache || [];
    const index = deals.findIndex(d => d.id === id);
    if (index !== -1) {
      deals[index] = data;
      dealsCache = deals;
    }
    return data;
  } catch (error) {
    console.error('Error updating deal:', error);
    throw error;
  }
}

export async function deleteDeal(id) {
  try {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Update cache
    dealsCache = (dealsCache || []).filter(d => d.id !== id);
  } catch (error) {
    console.error('Error deleting deal:', error);
    throw error;
  }
}
