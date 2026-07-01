import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    // Fetch markets and assets
    const [marketsRes, assetsRes] = await Promise.all([
      supabase.from('markets').select('id, name'),
      supabase.from('assets').select('id, name'),
    ]);

    if (marketsRes.error || assetsRes.error) {
      throw new Error('Failed to fetch portfolio data');
    }

    return Response.json({
      markets: marketsRes.data || [],
      assets: assetsRes.data || [],
    });
  } catch (error) {
    console.error('Portfolio data API error:', error);
    return Response.json(
      { error: 'Failed to fetch portfolio data', details: error.message },
      { status: 500 }
    );
  }
}
