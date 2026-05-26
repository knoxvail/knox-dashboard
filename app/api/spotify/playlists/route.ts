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

  const { uri } = await request.json();
  await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ context_uri: uri }),
  });

  return NextResponse.json({ success: true });
}
