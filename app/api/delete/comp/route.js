export async function DELETE(request) {
  const { id } = await request.json();

  try {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(
      `${baseUrl}/api/data/comps/${id}/delete`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CREST_API_KEY}`,
        },
      }
    );

    if (!response.ok) throw new Error('Failed to delete comp');

    return new Response(JSON.stringify({ success: true }), {
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
