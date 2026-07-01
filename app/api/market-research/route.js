/**
 * Market Research Endpoint
 * Takes a market name, uses Claude to research and suggest market details
 * based on the portfolio's asset types
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const API_KEY = process.env.CREST_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function POST(req) {
  const { marketName } = await req.json();

  if (!marketName || typeof marketName !== 'string') {
    return Response.json(
      { error: 'Market name is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch portfolio to understand asset types
    const [assetsRes, compsRes] = await Promise.all([
      supabase.from('assets').select('asset_class'),
      supabase.from('comps').select('market'),
    ]);

    if (assetsRes.error || compsRes.error) {
      throw new Error('Failed to fetch portfolio data');
    }

    const assets = assetsRes.data || [];
    const comps = compsRes.data || [];

    // Extract asset classes from portfolio
    const assetClassesSet = new Set(assets.map(a => a.asset_class).filter(Boolean));
    const assetClasses = Array.from(assetClassesSet).join(', ') || 'mixed asset types';

    const existingMarkets = comps.map(c => c.market).filter(Boolean).join(', ') || 'none yet';

    // Prompt Claude to research the market
    const systemPrompt = `You are a commercial real estate expert specializing in market analysis and research.
Your task is to research a market and provide structured data for creating a market entry in a portfolio tracking system.

When given a market name, you should:
1. Use your knowledge of that market
2. Consider the portfolio's existing asset types
3. Provide realistic, well-researched market characteristics
4. Format your response as JSON only (no other text)

Return JSON with exactly these fields:
{
  "name": "Market name",
  "asset_class": "Primary asset class (e.g., 'multifamily', 'industrial', 'office', 'retail')",
  "status": "scouting",
  "notes": "Brief 1-2 sentence description of the market, key characteristics, and why it's interesting for your asset types"
}`;

    const userPrompt = `Research the ${marketName} market for my portfolio.

My portfolio focuses on: ${assetClasses}
I'm already researching markets: ${existingMarkets}

Provide market research data for ${marketName} as JSON. Consider what asset classes make sense for this market based on my portfolio focus.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const assistantMessage = response.content[0]?.text || '';

    // Parse Claude's JSON response
    let marketData;
    try {
      marketData = JSON.parse(assistantMessage);
    } catch (e) {
      console.error('Failed to parse Claude response:', assistantMessage);
      throw new Error('Failed to parse market research data');
    }

    // Validate required fields
    if (!marketData.name || !marketData.asset_class) {
      throw new Error('Market research missing required fields');
    }

    // Create the market via the backend endpoint
    const createResponse = await fetch(`${API_URL}/api/data/markets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: marketData.name,
        asset_class: marketData.asset_class,
        status: marketData.status || 'scouting',
        notes: marketData.notes,
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.error || 'Failed to create market');
    }

    const createdMarket = await createResponse.json();

    return Response.json({
      success: true,
      market: createdMarket.market,
      research: marketData,
      summary: `✓ Created ${marketData.name} market (${marketData.asset_class} focus)`,
    });
  } catch (error) {
    console.error('Market research error:', error);
    return Response.json(
      { error: 'Failed to research and create market', details: error.message },
      { status: 500 }
    );
  }
}
