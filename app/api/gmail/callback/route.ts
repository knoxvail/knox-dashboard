import { NextRequest, NextResponse } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://knox-dashboard-pnsj.vercel.app";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("gmail_auth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (storedState && state !== storedState) {
    return NextResponse.redirect(new URL("/?gmail=error", SITE_URL));
  }

  if (error || !code) {
    return NextResponse.redirect(new URL("/?gmail=error", SITE_URL));
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${SITE_URL}/api/gmail/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/?gmail=error", SITE_URL));
    }

    // The login route prefixes the state with the account ("soren." or
    // "triad.") so we know which cookie pair this token belongs to.
    const isSoren = (state || "").startsWith("soren.");
    const accessName = isSoren ? "soren_gmail_access_token" : "gmail_access_token";
    const refreshName = isSoren ? "soren_gmail_refresh_token" : "gmail_refresh_token";

    const response = NextResponse.redirect(new URL("/?gmail=connected", SITE_URL));

    response.cookies.set({
      name: accessName,
      value: tokenData.access_token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      // 30 days so the cookie outlives the 1-hour token. A stale value triggers
      // the server's 401 -> refresh path instead of logging the user out.
      maxAge: 60 * 60 * 24 * 30,
    });

    if (tokenData.refresh_token) {
      response.cookies.set({
        name: refreshName,
        value: tokenData.refresh_token,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch {
    return NextResponse.redirect(new URL("/?gmail=error", SITE_URL));
  }
}
