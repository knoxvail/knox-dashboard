export async function POST(req) {
  const market = await req.json();
  const notionApiKey = process.env.NOTION_API_KEY;
  const marketDbId = process.env.NOTION_MARKETS_DB_ID;

  if (!notionApiKey || !marketDbId) {
    return Response.json(
      { error: 'Notion API key or database ID not configured' },
      { status: 500 }
    );
  }

  const statusOptions = {
    scouting: { name: 'Scouting', color: 'blue' },
    active: { name: 'Active', color: 'yellow' },
    passed: { name: 'Passed', color: 'red' },
    closed: { name: 'Closed', color: 'green' },
  };

  const assetOptions = {
    multifamily: { name: 'Multifamily', color: 'gray' },
    'mixed-use': { name: 'Mixed-Use', color: 'gray' },
    both: { name: 'Both', color: 'gray' },
  };

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2024-04-15',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: marketDbId },
        properties: {
          'Name': {
            title: [{ text: { content: market.name } }],
          },
          'Location': {
            rich_text: [{ text: { content: market.address || '' } }],
          },
          'Status': {
            select: statusOptions[market.status] || { name: market.status, color: 'gray' },
          },
          'Asset Class': {
            select: assetOptions[market.asset_class] || { name: market.asset_class, color: 'gray' },
          },
          'Score': {
            number: market.score || null,
          },
          'Notes': {
            rich_text: [{ text: { content: market.notes || '' } }],
          },
          'Created Date': {
            date: { start: market.created_at || new Date().toISOString() },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Notion API error:', error);
      return Response.json(
        { error: 'Failed to sync to Notion', details: error },
        { status: response.status }
      );
    }

    const result = await response.json();
    return Response.json(result);
  } catch (error) {
    console.error('Notion sync error:', error);
    return Response.json(
      { error: 'Failed to sync to Notion', details: error.message },
      { status: 500 }
    );
  }
}
