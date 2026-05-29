const NOTION_API_KEY = process.env.NEXT_PUBLIC_NOTION_API_KEY || process.env.NOTION_API_KEY;
const NOTION_VERSION = '2024-04-15';

async function notionRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://api.notion.com/v1${endpoint}`, options);
  if (!response.ok) {
    console.error(`Notion API error: ${response.status}`, await response.text());
    throw new Error(`Notion API: ${response.status}`);
  }
  return response.json();
}

export async function getDatabase(databaseId) {
  return notionRequest(`/databases/${databaseId}`);
}

export async function queryDatabase(databaseId, filter = null) {
  return notionRequest(`/databases/${databaseId}/query`, 'POST', { filter });
}

export async function createMarketInNotion(market) {
  const dbId = process.env.NEXT_PUBLIC_NOTION_MARKETS_DB_ID;
  if (!dbId) {
    console.warn('NOTION_MARKETS_DB_ID not set');
    return null;
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

  return notionRequest('/pages', 'POST', {
    parent: { database_id: dbId },
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
        date: { start: market.created_at },
      },
    },
  });
}

export async function updateMarketInNotion(pageId, market) {
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

  return notionRequest(`/pages/${pageId}`, 'PATCH', {
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
    },
  });
}
