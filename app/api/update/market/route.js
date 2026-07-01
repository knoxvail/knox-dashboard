export async function PATCH(request) {
  const { id, name } = await request.json();

  try {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(
      `${baseUrl}/api/data/markets/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CREST_API_KEY}`,
        },
        body: JSON.stringify({ name }),
      }
    );

    if (!response.ok) throw new Error('Failed to update market');

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
