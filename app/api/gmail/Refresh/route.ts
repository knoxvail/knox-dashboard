import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("gmail_refresh_token")?.value;
  if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.json();
    console.error("Gmail token refresh failed:", error);
    return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    console.error("No access token in response:", tokenData);
    return NextResponse.json({ error: "Invalid token response" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: "gmail_access_token",
    value: tokenData.access_token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}