export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Query required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch Google Images search page
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ imageUrl: null, message: 'Could not fetch images' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract image URLs - look for direct image URLs in the HTML
    const imageUrls = [];

    // Try multiple regex patterns to find image URLs
    const patterns = [
      /[\?&]imgurl=([^&]+)/g,
      /"imgUrl":"([^"]+)"/g,
      /\/imgres\?imgurl=([^&]+)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        try {
          const url = decodeURIComponent(match[1]);
          if (url.startsWith('http') && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp'))) {
            imageUrls.push(url);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
    }

    // Remove duplicates and return first valid image
    const uniqueUrls = [...new Set(imageUrls)];
    const firstImage = uniqueUrls[0] || null;

    return new Response(
      JSON.stringify({
        imageUrl: firstImage,
        searchUrl: searchUrl,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Property image search error:', error);
    return new Response(
      JSON.stringify({ imageUrl: null, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
