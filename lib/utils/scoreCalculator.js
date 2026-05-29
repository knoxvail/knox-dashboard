export const DEFAULT_WEIGHTS = {
  capRateVsMarket: 0.20,
  rentSFVsMarket: 0.20,
  vacancyRate: 0.15,
  rentGrowthTrend: 0.15,
  locationQuality: 0.15,
  dealBasis: 0.15,
};

export function calculateMarketAverages(comps) {
  if (comps.length === 0) {
    return {
      avgCapRate: 0,
      avgRentSF: 0,
      avgVacancy: 0,
      rentGrowth: 0,
    };
  }

  const soldComps = comps.filter(c => c.comp_type === 'sold');
  const leaseComps = comps.filter(c => c.comp_type === 'lease');

  const avgCapRate = soldComps.length > 0
    ? soldComps.reduce((sum, c) => sum + (c.cap_rate || 0), 0) / soldComps.length
    : 0;

  const avgRentSF = leaseComps.length > 0
    ? leaseComps.reduce((sum, c) => sum + (c.rent_per_sf || 0), 0) / leaseComps.length
    : 0;

  const avgVacancy = leaseComps.length > 0
    ? leaseComps.reduce((sum, c) => sum + (c.vacancy_rate || 0), 0) / leaseComps.length
    : 0;

  return {
    avgCapRate,
    avgRentSF,
    avgVacancy,
    rentGrowth: 0,
  };
}

export function calculateScore(deal, marketComps, weights = DEFAULT_WEIGHTS) {
  const market = calculateMarketAverages(marketComps);

  const scores = {
    capRateVsMarket: 0,
    rentSFVsMarket: 0,
    vacancyRate: 0,
    rentGrowthTrend: 0,
    locationQuality: 0,
    dealBasis: 0,
  };

  // Cap Rate vs Market (higher is better)
  if (market.avgCapRate > 0 && deal.cap_rate !== undefined) {
    const ratio = deal.cap_rate / market.avgCapRate;
    scores.capRateVsMarket = Math.min(100, (ratio / 1.5) * 100);
  }

  // Rent/SF vs Market (higher is better)
  if (market.avgRentSF > 0 && deal.rent_per_sf !== undefined) {
    const ratio = deal.rent_per_sf / market.avgRentSF;
    scores.rentSFVsMarket = Math.min(100, (ratio / 1.5) * 100);
  }

  // Vacancy Rate (lower is better)
  if (deal.vacancy_rate !== undefined) {
    scores.vacancyRate = Math.max(0, 100 - (deal.vacancy_rate * 5));
  }

  // Rent Growth Trend (placeholder)
  scores.rentGrowthTrend = 50;

  // Location Quality (user-provided 0-100)
  if (deal.locationQuality !== undefined) {
    scores.locationQuality = deal.locationQuality;
  }

  // Deal Basis (Price/Unit or Price/SF) - placeholder
  scores.dealBasis = 50;

  // Calculate weighted score
  const weightedScore =
    (scores.capRateVsMarket * weights.capRateVsMarket) +
    (scores.rentSFVsMarket * weights.rentSFVsMarket) +
    (scores.vacancyRate * weights.vacancyRate) +
    (scores.rentGrowthTrend * weights.rentGrowthTrend) +
    (scores.locationQuality * weights.locationQuality) +
    (scores.dealBasis * weights.dealBasis);

  return {
    score: Math.round(weightedScore),
    breakdown: scores,
    recommendation: getRecommendation(weightedScore),
  };
}

export function getRecommendation(score) {
  if (score >= 70) return { status: 'GO', color: 'green' };
  if (score >= 40) return { status: 'MAYBE', color: 'yellow' };
  return { status: 'NO-GO', color: 'red' };
}
