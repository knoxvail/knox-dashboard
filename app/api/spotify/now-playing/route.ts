import { NextRequest, NextResponse } from "next/server";

async function spotifyFetch(endpoint: string, token: string) {
  return fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
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
      const refreshed = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/spotify/refresh`, {
        method: "POST",
        headers: { cookie: request.headers.get("cookie") || "" },
      });
      if (!refreshed.ok) return NextResponse.json({ connected: false, expired: true });

      const newToken = refreshed.headers.get("set-cookie")?.match(/spotify_access_token=([^;]+)/)?.[1];
      if (!newToken) return NextResponse.json({ connected: false, expired: true });

      const retry = await spotifyFetch("/me/player", newToken);
      if (retry.status === 204) return NextResponse.json({ connected: true, playing: false });
      if (!retry.ok) return NextResponse.json({ connected: false, expired: true });

      const data = await retry.json();
      return buildPlayerResponse(data);
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