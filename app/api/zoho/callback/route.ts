import { NextRequest, NextResponse } from "next/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://knox-dashboard-pnsj.vercel.app";
const REGION = process.env.ZOHO_REGION || "com";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("zoho_auth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (storedState && state !== storedState) {
    return NextResponse.redirect(new URL("/?zoho=error", SITE_URL));
  }

  if (error || !code) {
    return NextResponse.redirect(new URL("/?zoho=error", SITE_URL));
  }

  try {
    const tokenResponse = await fetch(`https://accounts.zoho.${REGION}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        redirect_uri: `${SITE_URL}/api/zoho/callback`,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Zoho token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/?zoho=error", SITE_URL));
    }

    const response = NextResponse.redirect(new URL("/?zoho=connected", SITE_URL));

    response.cookies.set({
      name: "zoho_access_token",
      value: tokenData.access_token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      // 30 days so the cookie outlives the 1-hour token; a stale value just
      // triggers the 401 -> refresh path instead of logging the user out
      maxAge: 60 * 60 * 24 * 30,
    });

    if (tokenData.refresh_token) {
      response.cookies.set({
        name: "zoho_refresh_token",
        value: tokenData.refresh_token,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch {
    return NextResponse.redirect(new URL("/?zoho=error", SITE_URL));
  }
}
