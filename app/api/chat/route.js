import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { dealAnalyzer } from '@/lib/analysis/dealAnalyzer';
import { getAnalystPrompt } from '@/lib/analysis/prompts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define tools that Claude can use
const TOOLS = [
  {
    name: 'create_market',
    description: 'Create a new market region in the portfolio',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Market name (e.g., "Austin", "Denver")',
        },
        asset_class: {
          type: 'string',
          description: 'Primary asset class (e.g., "multifamily", "industrial", "office")',
        },
        status: {
          type: 'string',
          enum: ['scouting', 'interested', 'active', 'passed', 'closed'],
          description: 'Market status',
        },
        notes: {
          type: 'string',
          description: 'Notes about the market',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_asset',
    description: 'Create a new asset/property in a market',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Asset name',
        },
        market_id: {
          type: 'string',
          description: 'UUID of the market',
        },
        units: {
          type: 'number',
          description: 'Number of units',
        },
        purchase_price: {
          type: 'number',
          description: 'Purchase price in dollars',
        },
        cap_rate: {
          type: 'number',
          description: 'Cap rate as decimal (e.g., 0.05 for 5%)',
        },
        status: {
          type: 'string',
          enum: ['scouting', 'interested', 'active', 'passed', 'closed'],
          description: 'Asset status',
        },
        notes: {
          type: 'string',
          description: 'Notes about the asset',
        },
      },
      required: ['name', 'market_id'],
    },
  },
  {
    name: 'create_comp',
    description: 'Create a comparable sale/comp',
    input_schema: {
      type: 'object',
      properties: {
        comp_name: {
          type: 'string',
          description: 'Name of the comparable property',
        },
        asset_id: {
          type: 'string',
          description: 'UUID of the asset this comp is compared to',
        },
        price: {
          type: 'number',
          description: 'Sale price in dollars',
        },
        price_per_unit: {
          type: 'number',
          description: 'Price per unit',
        },
        cap_rate: {
          type: 'number',
          description: 'Cap rate as decimal',
        },
        sale_date: {
          type: 'string',
          description: 'Sale date (YYYY-MM-DD)',
        },
      },
      required: ['comp_name', 'asset_id'],
    },
  },
];

export async function POST(req) {
  const { message, screenshot } = await req.json();

  if (!message || typeof message !== 'string') {
    return Response.json(
      { error: 'Message is required' },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'Claude API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch full portfolio from Supabase
    const [marketsRes, assetsRes, compsRes] = await Promise.all([
      supabase.from('markets').select('*'),
      supabase.from('assets').select('*'),
      supabase.from('comps').select('*'),
    ]);

    if (marketsRes.error || assetsRes.error || compsRes.error) {
      throw new Error('Failed to fetch portfolio data');
    }

    const markets = marketsRes.data || [];
    const assets = assetsRes.data || [];
    const comps = compsRes.data || [];

    // Build portfolio context
    const portfolioContext = buildPortfolioContext(markets, assets, comps);

    // Get system prompt
    const systemPrompt = getAnalystPrompt(portfolioContext);

    // Build message content (text + optional image)
    const messageContent = [];

    // Add image if provided
    if (screenshot && screenshot.startsWith('data:image')) {
      const base64Data = screenshot.split(',')[1];
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64Data,
        },
      });
    }

    // Add text message
    messageContent.push({
      type: 'text',
      text: message,
    });

    // Call Claude API with tools
    let response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    });

    // Handle tool use in a loop
    let assistantMessage = '';
    let toolResults = [];

    while (response.stop_reason === 'tool_use') {
      // Extract text and tool calls from response
      const textBlock = response.content.find((block) => block.type === 'text');
      if (textBlock) {
        assistantMessage = textBlock.text;
      }

      const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');

      // Execute each tool call
      for (const toolUse of toolUseBlocks) {
        try {
          let result;

          if (toolUse.name === 'create_market') {
            const { name, asset_class, status, notes } = toolUse.input;
            const { data, error } = await supabase
              .from('markets')
              .insert([
                {
                  name,
                  asset_class: asset_class || null,
                  status: status || 'scouting',
                  notes: notes || null,
                },
              ])
              .select();

            if (error) throw error;
            result = `Created market: ${data[0]?.name}`;
          } else if (toolUse.name === 'create_asset') {
            const { name, market_id, units, purchase_price, cap_rate, status, notes } = toolUse.input;
            const { data, error } = await supabase
              .from('assets')
              .insert([
                {
                  name,
                  market_id,
                  units: units || null,
                  purchase_price: purchase_price || null,
                  cap_rate: cap_rate || null,
                  status: status || 'scouting',
                  notes: notes || null,
                },
              ])
              .select();

            if (error) throw error;
            result = `Created asset: ${data[0]?.name}`;
          } else if (toolUse.name === 'create_comp') {
            const { comp_name, asset_id, price, price_per_unit, cap_rate, sale_date } = toolUse.input;
            const { data, error } = await supabase
              .from('comps')
              .insert([
                {
                  comp_name,
                  asset_id,
                  price: price || null,
                  price_per_unit: price_per_unit || null,
                  cap_rate: cap_rate || null,
                  sale_date: sale_date || null,
                },
              ])
              .select();

            if (error) throw error;
            result = `Created comp: ${data[0]?.comp_name}`;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${error.message}`,
            is_error: true,
          });
        }
      }

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
          {
            role: 'assistant',
            content: response.content,
          },
          {
            role: 'user',
            content: toolResults,
          },
        ],
      });
    }

    // Extract final text response
    const finalTextBlock = response.content.find((block) => block.type === 'text');
    const finalMessage = finalTextBlock?.text || assistantMessage || 'Done!';

    // Generate suggestions for quick actions
    const suggestions = generateSuggestions(assets, markets);

    return Response.json({
      response: finalMessage,
      suggestions,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Failed to process chat message', details: error.message },
      { status: 500 }
    );
  }
}

function buildPortfolioContext(markets, assets, comps) {
  return {
    markets: markets.map((m) => ({
      id: m.id,
      name: m.name,
      address: m.address,
      status: m.status,
      asset_class: m.asset_class,
      lat: m.latitude,
      lng: m.longitude,
      score: m.score,
    })),
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      market_id: a.market_id,
      status: a.status,
      asset_class: a.asset_class,
      units: a.units,
      purchase_price: a.purchase_price,
      cap_rate: a.cap_rate,
      noi: a.noi,
      lat: a.latitude,
      lng: a.longitude,
    })),
    comps: comps.map((c) => ({
      id: c.id,
      asset_id: c.asset_id,
      name: c.comp_name,
      price: c.price,
      price_per_unit: c.price_per_unit,
      cap_rate: c.cap_rate,
      market: c.market,
      sale_date: c.sale_date,
    })),
    summary: {
      total_markets: markets.length,
      total_assets: assets.length,
      total_comps: comps.length,
      markets_by_status: groupBy(markets, 'status'),
      assets_by_status: groupBy(assets, 'status'),
    },
  };
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const group = item[key] || 'unknown';
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});
}

function generateSuggestions(assets, markets) {
  const suggestions = [];

  if (assets.length > 10) {
    suggestions.push(`You have ${assets.length} assets. Want me to prioritize them by fundamentals?`);
  }

  const unscoredAssets = assets.filter((a) => !a.score);
  if (unscoredAssets.length > 0) {
    suggestions.push(`${unscoredAssets.length} assets don't have scores yet. Want me to analyze them?`);
  }

  const scoutingMarkets = markets.filter((m) => m.status === 'scouting');
  if (scoutingMarkets.length > 0) {
    suggestions.push(`You're scouting ${scoutingMarkets.length} markets. Want market insights?`);
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
}
