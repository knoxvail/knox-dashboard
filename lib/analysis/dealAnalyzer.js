// Deal scoring and analysis utilities for chat and newsletter

export const dealAnalyzer = {
  scoreDeal,
  analyzePricing,
  marketInsights,
  suggestPriorities,
};

/**
 * Score an asset based on fundamentals and market comps
 * Returns: { score: 1-10, reasoning: string, components: object }
 */
function scoreDeal(asset, comps, market) {
  if (!asset || !market) {
    return { score: null, reasoning: 'Insufficient data', components: {} };
  }

  const components = {
    capRateScore: scoreCapRate(asset.cap_rate),
    priceMultiple: scorePriceMultiple(asset, comps),
    marketScore: scoreMarketConditions(market),
    fundamentalsScore: scoreFundamentals(asset),
  };

  // Weighted average
  const score =
    (components.capRateScore * 0.3 +
      components.priceMultiple * 0.3 +
      components.marketScore * 0.2 +
      components.fundamentalsScore * 0.2) /
    10;

  const reasoning = buildScoringReasoning(asset, components, comps);

  return {
    score: Math.round(score),
    reasoning,
    components,
  };
}

/**
 * Analyze pricing vs comparable sales
 * Returns: { fairValue: number, variance: number, compsUsed: count }
 */
function analyzePricing(asset, comps) {
  if (!asset || !comps || comps.length === 0) {
    return {
      fairValue: asset?.purchase_price || null,
      variance: 0,
      compsUsed: 0,
      reasoning: 'No comps available',
    };
  }

  // Filter relevant comps (same asset class, recent sales)
  const relevantComps = comps.filter((c) => {
    // Could add more filters like location, size, etc.
    return c.price_per_unit !== null;
  });

  if (relevantComps.length === 0) {
    return {
      fairValue: asset.purchase_price,
      variance: 0,
      compsUsed: 0,
      reasoning: 'No relevant comps found',
    };
  }

  // Calculate weighted average price per unit
  const avgPricePerUnit =
    relevantComps.reduce((sum, c) => sum + (c.price_per_unit || 0), 0) /
    relevantComps.length;

  const units = asset.units || 1;
  const fairValue = avgPricePerUnit * units;
  const variance =
    asset.purchase_price && asset.purchase_price !== 0
      ? ((fairValue - asset.purchase_price) / asset.purchase_price) * 100
      : 0;

  return {
    fairValue: Math.round(fairValue),
    variance: Math.round(variance * 10) / 10,
    compsUsed: relevantComps.length,
    reasoning: buildPricingReasoning(asset, fairValue, variance, relevantComps),
  };
}

/**
 * Provide market insights
 * Returns: { capRateRange, trendDirection, conditions, recommendations: string[] }
 */
function marketInsights(market, assets) {
  const marketAssets = assets.filter((a) => a.market_id === market.id);

  if (marketAssets.length === 0) {
    return {
      capRateRange: null,
      trendDirection: 'unknown',
      conditions: 'Insufficient data',
      recommendations: [],
    };
  }

  const capRates = marketAssets
    .map((a) => a.cap_rate)
    .filter((cr) => cr !== null && cr !== undefined);

  const avgCapRate = capRates.length > 0 ? capRates.reduce((a, b) => a + b) / capRates.length : null;
  const minCapRate = capRates.length > 0 ? Math.min(...capRates) : null;
  const maxCapRate = capRates.length > 0 ? Math.max(...capRates) : null;

  const recommendations = buildMarketRecommendations(market, marketAssets);

  return {
    capRateRange: {
      min: minCapRate ? Math.round(minCapRate * 100) / 100 : null,
      avg: avgCapRate ? Math.round(avgCapRate * 100) / 100 : null,
      max: maxCapRate ? Math.round(maxCapRate * 100) / 100 : null,
    },
    marketStatus: market.status || 'unknown',
    assetCount: marketAssets.length,
    recommendations,
  };
}

/**
 * Suggest priorities for unanalyzed assets
 * Returns: { prioritized: asset[], reasoning: string }
 */
function suggestPriorities(assets) {
  if (!assets || assets.length === 0) {
    return { prioritized: [], reasoning: 'No assets to prioritize' };
  }

  // Score assets by fundamentals
  const scored = assets
    .map((a) => ({
      asset: a,
      score: calculateAssetPriority(a),
    }))
    .sort((a, b) => b.score - a.score);

  const topPriorities = scored.slice(0, Math.min(5, scored.length));

  return {
    prioritized: topPriorities.map((p) => p.asset),
    reasoning: `Prioritized by cap rate (${Math.round(topPriorities[0]?.score || 0)}%), market status, and unit count`,
  };
}

// --- Helper functions ---

function scoreCapRate(capRate) {
  if (!capRate) return 5;
  if (capRate >= 8) return 10;
  if (capRate >= 7) return 9;
  if (capRate >= 6) return 8;
  if (capRate >= 5) return 7;
  if (capRate >= 4) return 6;
  return 4;
}

function scorePriceMultiple(asset, comps) {
  if (!comps || comps.length === 0) return 5;

  const relevantComps = comps.filter((c) => c.price_per_unit !== null);
  if (relevantComps.length === 0) return 5;

  const avgPricePerUnit =
    relevantComps.reduce((sum, c) => sum + c.price_per_unit, 0) / relevantComps.length;
  const assetPricePerUnit = asset.purchase_price && asset.units ? asset.purchase_price / asset.units : avgPricePerUnit;

  const variance = ((assetPricePerUnit - avgPricePerUnit) / avgPricePerUnit) * 100;

  if (variance < -15) return 10; // Significantly underpriced
  if (variance < -5) return 9;
  if (variance < 5) return 8;
  if (variance < 15) return 6;
  return 4; // Overpriced
}

function scoreMarketConditions(market) {
  const statusScores = {
    active: 9,
    scouting: 7,
    passed: 3,
    closed: 2,
  };
  return statusScores[market.status] || 5;
}

function scoreFundamentals(asset) {
  let score = 5;

  if (asset.units && asset.units > 50) score += 2;
  if (asset.noi && asset.noi > 0) score += 1;
  if (asset.cap_rate && asset.cap_rate > 0) score += 1;

  return Math.min(score, 10);
}

function buildScoringReasoning(asset, components, comps) {
  const parts = [];

  if (components.capRateScore >= 8) {
    parts.push(`Strong cap rate of ${asset.cap_rate}%`);
  } else if (components.capRateScore < 6) {
    parts.push(`Weak cap rate of ${asset.cap_rate}%`);
  }

  if (components.priceMultiple >= 8) {
    parts.push('Attractive pricing vs comps');
  } else if (components.priceMultiple <= 5) {
    parts.push('Premium pricing vs comps');
  }

  if (asset.units > 100) {
    parts.push(`Large asset (${asset.units} units)`);
  }

  return parts.length > 0 ? parts.join('; ') : 'Moderate fundamentals';
}

function buildPricingReasoning(asset, fairValue, variance, comps) {
  let direction = 'fairly valued';
  if (variance > 10) direction = 'undervalued';
  else if (variance < -10) direction = 'overvalued';

  return `${direction} vs ${comps.length} comps (fair value: $${fairValue.toLocaleString()})`;
}

function buildMarketRecommendations(market, assets) {
  const recommendations = [];

  if (market.status === 'scouting' && assets.length < 3) {
    recommendations.push('Market is early stage, keep monitoring');
  }

  if (market.status === 'active') {
    recommendations.push('Market is performing well, good acquisition opportunity');
  }

  const avgCapRate = assets.reduce((sum, a) => sum + (a.cap_rate || 0), 0) / assets.length;
  if (avgCapRate > 7) {
    recommendations.push('High cap rates indicate strong cash flow potential');
  }

  return recommendations.slice(0, 2);
}

function calculateAssetPriority(asset) {
  let score = 0;

  if (asset.cap_rate) score += asset.cap_rate * 10;
  if (asset.status === 'scouting') score += 30;
  if (asset.status === 'active') score += 50;
  if (asset.units > 100) score += 20;

  return score;
}
