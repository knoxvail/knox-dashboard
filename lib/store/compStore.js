const COMPS_KEY = 'cre_comps';

export function loadComps() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(COMPS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveComps(comps) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COMPS_KEY, JSON.stringify(comps));
}

export function addComp(comp) {
  const comps = loadComps();
  const newComp = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    ...comp,
  };
  comps.push(newComp);
  saveComps(comps);
  return newComp;
}

export function updateComp(id, updates) {
  const comps = loadComps();
  const index = comps.findIndex(c => c.id === id);
  if (index !== -1) {
    comps[index] = { ...comps[index], ...updates };
    saveComps(comps);
    return comps[index];
  }
  return null;
}

export function deleteComp(id) {
  const comps = loadComps();
  const filtered = comps.filter(c => c.id !== id);
  saveComps(filtered);
}

export function getCompById(id) {
  const comps = loadComps();
  return comps.find(c => c.id === id);
}

export function getCompsByMarket(marketId) {
  const comps = loadComps();
  return comps.filter(c => c.market_id === marketId);
}
