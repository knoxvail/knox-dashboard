import { NextRequest, NextResponse } from "next/server";

const SITE_URL = "https://knox-dashboard-pnsj.vercel.app";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("spotify_auth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (storedState && state !== storedState) {
    return NextResponse.redirect(new URL("/?spotify=error", SITE_URL));
  }

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify=error", SITE_URL));
  }

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
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || "",
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/?spotify=error", SITE_URL));
    }

    const response = NextResponse.redirect(new URL("/?spotify=connected", SITE_URL));

    response.cookies.set({
      name: "spotify_access_token",
      value: tokenData.access_token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: tokenData.expires_in,
    });

    if (tokenData.refresh_token) {
      response.cookies.set({
        name: "spotify_refresh_token",
        value: tokenData.refresh_token,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err) {
    return NextResponse.redirect(new URL("/?spotify=error", SITE_URL));
  }
}