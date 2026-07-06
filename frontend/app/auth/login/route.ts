import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Simulate redirecting to Google's OAuth consent screen
  const callbackUrl = new URL("/auth/callback?code=mock_auth_code&state=mock_oauth_state", request.url);
  return NextResponse.redirect(callbackUrl);
}
