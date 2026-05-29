const MARKETS_KEY = 'cre_markets';

export function loadMarkets() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MARKETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveMarkets(markets) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MARKETS_KEY, JSON.stringify(markets));
}

export function addMarket(market) {
  const markets = loadMarkets();
  const newMarket = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    created_by: 'user',
    ...market,
  };
  markets.push(newMarket);
  saveMarkets(markets);
  return newMarket;
}

export function updateMarket(id, updates) {
  const markets = loadMarkets();
  const index = markets.findIndex(m => m.id === id);
  if (index !== -1) {
    markets[index] = { ...markets[index], ...updates };
    saveMarkets(markets);
    return markets[index];
  }
  return null;
}

export function deleteMarket(id) {
  const markets = loadMarkets();
  const filtered = markets.filter(m => m.id !== id);
  saveMarkets(filtered);
}

export function getMarketById(id) {
  const markets = loadMarkets();
  return markets.find(m => m.id === id);
}
