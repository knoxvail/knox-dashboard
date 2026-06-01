import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("spotify_refresh_token")?.value;
  if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

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

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error("Spotify token refresh failed:", error);
      return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("No access token in Spotify response:", tokenData);
      return NextResponse.json({ error: "Invalid token response" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: "spotify_access_token",
      value: tokenData.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in || 3600,
    });

    return response;
  } catch (error) {
    console.error("Spotify refresh error:", error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
