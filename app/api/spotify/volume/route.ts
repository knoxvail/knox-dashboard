import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const { volume } = await request.json();

  await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });

  return NextResponse.json({ success: true });
}