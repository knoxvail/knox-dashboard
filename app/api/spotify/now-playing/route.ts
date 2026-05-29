import { NextRequest, NextResponse } from "next/server";

async function spotifyFetch(endpoint: string, token: string) {
  return fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

async function refreshSpotifyToken(refreshToken: string) {
  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!tokenResponse.ok) return null;
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch {
    return null;
  }
}

function buildPlayerResponse(data: any) {
  return NextResponse.json({
    connected: true,
    playing: data.is_playing,
    track: data.item?.name,
    artist: data.item?.artists?.map((a: any) => a.name).join(", "),
    album: data.item?.album?.name,
    albumArt: data.item?.album?.images?.[0]?.url,
    progress: data.progress_ms,
    duration: data.item?.duration_ms,
    deviceName: data.device?.name,
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  if (!token) return NextResponse.json({ connected: false });

  try {
    const res = await spotifyFetch("/me/player", token);

    if (res.status === 204) return NextResponse.json({ connected: true, playing: false });

    if (res.status === 401) {
      const refreshToken = request.cookies.get("spotify_refresh_token")?.value;
      if (!refreshToken) return NextResponse.json({ connected: false, expired: true });

      const newToken = await refreshSpotifyToken(refreshToken);
      if (!newToken) return NextResponse.json({ connected: false, expired: true });

      const response = NextResponse.json({ connected: true, playing: false });
      response.cookies.set({
        name: "spotify_access_token",
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600,
      });

      const retry = await spotifyFetch("/me/player", newToken);
      if (retry.status === 204) return response;
      if (!retry.ok) return NextResponse.json({ connected: false, expired: true });

      const data = await retry.json();
      const playerResponse = buildPlayerResponse(data);
      playerResponse.cookies.set({
        name: "spotify_access_token",
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600,
      });
      return playerResponse;
    }

    const data = await res.json();
    return buildPlayerResponse(data);
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const { action } = await request.json();
  const endpoints: Record<string, { path: string; method: string }> = {
    play: { path: "/me/player/play", method: "PUT" },
    pause: { path: "/me/player/pause", method: "PUT" },
    next: { path: "/me/player/next", method: "POST" },
    previous: { path: "/me/player/previous", method: "POST" },
  };

  const ep = endpoints[action];
  if (!ep) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  await fetch(`https://api.spotify.com/v1${ep.path}`, {
    method: ep.method,
    headers: { Authorization: `Bearer ${token}` },
  });

  return NextResponse.json({ success: true });
}