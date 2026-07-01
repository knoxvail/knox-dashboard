/**
 * Backend proxy for creating a market
 * This endpoint is called by the frontend and uses the server-side CREST_API_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.CREST_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function POST(req) {
  try {
    const body = await req.json();

    // Call the actual CREST API endpoint with the server-side API key
    const response = await fetch(`${API_URL}/api/data/markets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json(error, { status: response.status });
    }

    return Response.json(await response.json(), { status: 201 });
  } catch (error) {
    console.error('Create market error:', error);
    return Response.json(
      { error: 'Failed to create market', details: error.message },
      { status: 500 }
    );
  }
}
