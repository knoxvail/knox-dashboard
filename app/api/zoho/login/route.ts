import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://knox-dashboard-pnsj.vercel.app";

// Zoho is region-sharded; default to .com and allow override (eu, in, com.au...)
const REGION = process.env.ZOHO_REGION || "com";

export async function GET(request: NextRequest) {
  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error: "Zoho is not configured yet.",
        fix: "Create a Server-based client at https://api-console.zoho.com with redirect URI " +
          `${SITE_URL}/api/zoho/callback, then set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in Vercel and redeploy.`,
      },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const response = new NextResponse(null, { status: 302 });
  response.cookies.set({
    name: "zoho_auth_state",
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOHO_CLIENT_ID,
    scope: "ZohoMail.accounts.READ,ZohoMail.messages.ALL",
    redirect_uri: `${SITE_URL}/api/zoho/callback`,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  response.headers.set("Location", `https://accounts.zoho.${REGION}/oauth/v2/auth?${params}`);
  return response;
}
