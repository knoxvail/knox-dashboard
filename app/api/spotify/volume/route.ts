import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  try {
    const { volume } = await request.json();

    if (typeof volume !== "number" || volume < 0 || volume > 100) {
      return NextResponse.json({ error: "Volume must be between 0 and 100" }, { status: 400 });
    }

    const res = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(volume)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 204) {
      return NextResponse.json({ error: "Failed to set volume" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/spotify/volume error:", error);
    return NextResponse.json({ error: "Failed to set volume" }, { status: 500 });
  }
}