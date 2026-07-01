import { supabase } from '../supabase';

const DRAWINGS_KEY = 'cre_drawings';
let drawingsCache = null;

function getLocalDrawings() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DRAWINGS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function setLocalDrawings(drawings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DRAWINGS_KEY, JSON.stringify(drawings));
}

export async function loadDrawings() {
  try {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    drawingsCache = data || [];
    setLocalDrawings(drawingsCache);
    return drawingsCache;
  } catch (error) {
    console.error('Error loading drawings from Supabase, using local cache:', error);
    const cached = getLocalDrawings();
    drawingsCache = cached;
    return cached;
  }
}

export async function addDrawing(drawing) {
  const newDrawing = {
    name: drawing.name,
    description: drawing.description || null,
    paths: drawing.paths, // array of { lat, lng }
    color: drawing.color || '#6366f1',
    kind: drawing.kind || 'region', // 'region' | 'market'
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('drawings')
      .insert([newDrawing])
      .select()
      .single();

    if (error) throw error;

    const updated = [data, ...(drawingsCache || [])];
    drawingsCache = updated;
    setLocalDrawings(updated);
    return data;
  } catch (error) {
    console.error('Error adding drawing to Supabase, saving locally:', error);
    const localId = `local-${Date.now()}`;
    const localDrawing = { id: localId, ...newDrawing };
    const updated = [localDrawing, ...(drawingsCache || getLocalDrawings())];
    drawingsCache = updated;
    setLocalDrawings(updated);
    return localDrawing;
  }
}

export async function updateDrawing(id, updates) {
  try {
    const { data, error } = await supabase
      .from('drawings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const list = (drawingsCache || getLocalDrawings()).map((d) =>
      d.id === id ? data : d
    );
    drawingsCache = list;
    setLocalDrawings(list);
    return data;
  } catch (error) {
    console.error('Error updating drawing in Supabase, updating locally:', error);
    const list = (drawingsCache || getLocalDrawings()).map((d) =>
      d.id === id ? { ...d, ...updates } : d
    );
    drawingsCache = list;
    setLocalDrawings(list);
    return list.find((d) => d.id === id);
  }
}

export async function deleteDrawing(id) {
  try {
    const { error } = await supabase
      .from('drawings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting drawing from Supabase:', error);
  } finally {
    const updated = (drawingsCache || getLocalDrawings()).filter((d) => d.id !== id);
    drawingsCache = updated;
    setLocalDrawings(updated);
  }
}
