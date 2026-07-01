import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.CREST_API_KEY;

export async function POST(req) {
  // Validate API key
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing or invalid authorization' }, { status: 401 });
  }

  const providedKey = authHeader.slice(7);
  if (providedKey !== API_KEY) {
    return Response.json({ error: 'Invalid API key' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      market_id,
      name,
      status,
      asset_class,
      units,
      purchase_price,
      cap_rate,
      noi,
      latitude,
      longitude,
      score,
      notes,
    } = body;

    // Validate required fields
    if (!name || !market_id) {
      return Response.json(
        { error: 'Asset name and market_id are required' },
        { status: 400 }
      );
    }

    // Insert asset
    const { data, error } = await supabase
      .from('assets')
      .insert([
        {
          market_id,
          name,
          status: status || 'scouting',
          asset_class: asset_class || null,
          units: units || null,
          purchase_price: purchase_price || null,
          cap_rate: cap_rate || null,
          noi: noi || null,
          latitude: latitude || null,
          longitude: longitude || null,
          score: score || null,
          notes: notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json(
        { error: 'Failed to create asset', details: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true, asset: data[0] }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      { error: 'Failed to create asset', details: error.message },
      { status: 500 }
    );
  }
}
