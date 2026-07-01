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
      asset_id,
      comp_name,
      price,
      price_per_unit,
      cap_rate,
      market,
      sale_date,
      notes,
    } = body;

    // Validate required fields
    if (!asset_id || !comp_name) {
      return Response.json(
        { error: 'asset_id and comp_name are required' },
        { status: 400 }
      );
    }

    // Insert comp
    const { data, error } = await supabase
      .from('comps')
      .insert([
        {
          asset_id,
          comp_name,
          price: price || null,
          price_per_unit: price_per_unit || null,
          cap_rate: cap_rate || null,
          market: market || null,
          sale_date: sale_date || null,
          notes: notes || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json(
        { error: 'Failed to create comp', details: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true, comp: data[0] }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      { error: 'Failed to create comp', details: error.message },
      { status: 500 }
    );
  }
}
