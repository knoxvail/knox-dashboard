export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return new Response(JSON.stringify({ error: "Query required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Tier 1: Try direct geocoding
    const geocodingResult = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );

    const geocodingData = await geocodingResult.json();

    if (geocodingData.results && geocodingData.results.length > 0) {
      const result = geocodingData.results[0];
      return new Response(
        JSON.stringify({
          success: true,
          source: "geocoding",
          location: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Tier 2: Fallback to Haiku for refinement (if Anthropic API is available)
    if (process.env.ANTHROPIC_API_KEY) {
      const Anthropic = await import("@anthropic-ai/sdk").then(m => m.default);
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      try {
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          messages: [
            {
              role: "user",
              content: `Parse this location search query and extract the main city/location.
Query: "${query}"
Respond with ONLY a city name or location that Google Maps can geocode. Be concise.`,
            },
          ],
        });

        const refinedQuery = message.content[0].text.trim();

        // Try geocoding the refined query
        const refinedGeocoding = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(refinedQuery)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );

        const refinedData = await refinedGeocoding.json();

        if (refinedData.results && refinedData.results.length > 0) {
          const result = refinedData.results[0];
          return new Response(
            JSON.stringify({
              success: true,
              source: "haiku_refined",
              originalQuery: query,
              refinedQuery: refinedQuery,
              location: result.formatted_address,
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch (haiku_error) {
        console.warn("Haiku refinement failed, returning direct geocoding result:", haiku_error);
      }
    }

    // Return error if both methods failed
    return new Response(
      JSON.stringify({
        success: false,
        error: "Could not geocode location",
        query: query,
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Location search error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
