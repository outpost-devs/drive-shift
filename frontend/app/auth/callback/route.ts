import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mockStore } from "@/lib/mocks/store";

export async function GET(request: NextRequest) {
  // Simulate receiving Google callback, verify state
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state");

  if (state !== "mock_oauth_state") {
    return NextResponse.json(
      { error: "invalid_state", message: "OAuth state verification failed" },
      { status: 400 }
    );
  }

  // Set in-memory session login flag
  mockStore.isLoggedIn = true;

  // Set mock httpOnly cookie (Next.js 15+ cookies() is async)
  const cookieStore = await cookies();
  cookieStore.set("SESSION", "mock-session-uuid-xyz123", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 3600 // 1 hour
  });

  // Redirect to dashboard page
  const dashboardUrl = new URL("/dashboard", request.url);
  return NextResponse.redirect(dashboardUrl);
}
