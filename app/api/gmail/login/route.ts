import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SITE_URL = "https://knox-dashboard-pnsj.vercel.app";

export async function GET(request: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");

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
    scope: "https://www.googleapis.com/auth/gmail.modify",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  response.headers.set("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  return response;
}