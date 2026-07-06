import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Redirect to callback/drive simulating permission authorization for Source drive
  const targetUrl = new URL("/auth/callback/drive?state=source", request.url);
  return NextResponse.redirect(targetUrl);
}
