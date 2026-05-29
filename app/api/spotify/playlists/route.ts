import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  if (!token) return NextResponse.json({ playlists: [] });

  try {
    const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=10", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    const playlists = (data.items || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      uri: p.uri,
      image: p.images?.[0]?.url,
    }));
    return NextResponse.json({ playlists });
  } catch {
    return NextResponse.json({ playlists: [] });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  try {
    const { uri } = await request.json();

    if (!uri || typeof uri !== "string") {
      return NextResponse.json({ error: "Invalid playlist URI" }, { status: 400 });
    }

    if (!uri.startsWith("spotify:")) {
      return NextResponse.json({ error: "Invalid Spotify URI" }, { status: 400 });
    }

    const res = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context_uri: uri }),
    });

    if (!res.ok && res.status !== 204) {
      return NextResponse.json({ error: "Failed to play playlist" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/spotify/playlists error:", error);
    return NextResponse.json({ error: "Failed to play playlist" }, { status: 500 });
  }
}
