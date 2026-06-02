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

function setAccessCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: "spotify_access_token",
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Keep the cookie for 30 days so it survives past the access token's 1-hour
    // lifetime. A stale value just triggers the 401 -> refresh path rather than
    // silently dropping us back to "Connect to Spotify".
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function refreshAndFetch(refreshToken: string) {
  const newToken = await refreshSpotifyToken(refreshToken);
  if (!newToken) return NextResponse.json({ connected: false, expired: true });

  let playerData: any = null;
  try {
    const retry = await spotifyFetch("/me/player", newToken);
    if (retry.ok && retry.status !== 204) {
      playerData = await retry.json();
    }
  } catch (error) {
    console.error("Error fetching player data after Spotify token refresh:", error);
  }

  const response = playerData
    ? buildPlayerResponse(playerData)
    : NextResponse.json({ connected: true, playing: false });
  setAccessCookie(response, newToken);
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("spotify_access_token")?.value;
  const refreshToken = request.cookies.get("spotify_refresh_token")?.value;

  // No credentials at all -> genuinely disconnected.
  if (!token && !refreshToken) return NextResponse.json({ connected: false });

  // Access token cookie expired/was deleted but the refresh token is still
  // valid -> refresh proactively instead of reporting "not connected".
  if (!token && refreshToken) return refreshAndFetch(refreshToken);

  try {
    const res = await spotifyFetch("/me/player", token!);

    if (res.status === 204) return NextResponse.json({ connected: true, playing: false });

    if (res.status === 401) {
      if (!refreshToken) return NextResponse.json({ connected: false, expired: true });
      return refreshAndFetch(refreshToken);
    }

    const data = await res.json();
    return buildPlayerResponse(data);
  } catch {
    if (refreshToken) return refreshAndFetch(refreshToken);
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