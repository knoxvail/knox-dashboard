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

  const tokenData = await tokenResponse.json();
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: "gmail_access_token",
    value: tokenData.access_token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: tokenData.expires_in,
  });

  return response;
}