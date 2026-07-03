import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://knox-dashboard-pnsj.vercel.app";

export async function GET(request: NextRequest) {
  // Which account this login is for ("triad" default, or "soren"). Carried
  // through the OAuth round-trip inside the state param so the callback knows
  // which cookie pair to set.
  const acct = request.nextUrl.searchParams.get("acct") === "soren" ? "soren" : "triad";
  const state = `${acct}.${crypto.randomBytes(16).toString("hex")}`;

  const response = new NextResponse(null, { status: 302 });
  response.cookies.set({
    name: "gmail_auth_state",
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${SITE_URL}/api/gmail/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  response.headers.set("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  return response;
}