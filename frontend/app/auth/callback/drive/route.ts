import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state");

  if (state === "source") {
    mockStore.isSourceConnected = true;
  } else if (state === "target") {
    mockStore.isTargetConnected = true;
  } else {
    return NextResponse.json(
      { error: "invalid_state", message: "OAuth state verification failed" },
      { status: 400 }
    );
  }

  // Redirect back to dashboard
  const dashboardUrl = new URL("/dashboard", request.url);
  return NextResponse.redirect(dashboardUrl);
}
