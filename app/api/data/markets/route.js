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
    const { name, address, status, asset_class, latitude, longitude, score, notes } = body;

    // Validate required fields
    if (!name) {
      return Response.json({ error: 'Market name is required' }, { status: 400 });
    }

    // Insert market
    const { data, error } = await supabase
      .from('markets')
      .insert([
        {
          name,
          address: address || null,
          status: status || 'scouting',
          asset_class: asset_class || null,
          latitude: latitude || null,
          longitude: longitude || null,
          score: score || null,
          notes: notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Failed to create market', details: error.message }, { status: 500 });
    }

    return Response.json({ success: true, market: data[0] }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Failed to create market', details: error.message }, { status: 500 });
  }
}
