/**
 * CREST API utility functions for creating markets, assets, and comps
 * These call backend proxy endpoints that handle authentication securely
 */

/**
 * Create a new market
 */
export async function createMarket(marketData) {
  try {
    const response = await fetch('/api/create/market', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(marketData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create market');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating market:', error);
    throw error;
  }
}

/**
 * Create a new asset
 */
export async function createAsset(assetData) {
  try {
    const response = await fetch('/api/create/asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assetData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create asset');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating asset:', error);
    throw error;
  }
}

/**
 * Create a new comp
 */
export async function createComp(compData) {
  try {
    const response = await fetch('/api/create/comp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(compData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create comp');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating comp:', error);
    throw error;
  }
}

/**
 * Research and create a market using Claude
 * Claude analyzes the market and portfolio context to create smart market defaults
 */
export async function createMarketWithResearch(marketName) {
  try {
    const response = await fetch('/api/market-research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ marketName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to research market');
    }

    return await response.json();
  } catch (error) {
    console.error('Error researching market:', error);
    throw error;
  }
}
