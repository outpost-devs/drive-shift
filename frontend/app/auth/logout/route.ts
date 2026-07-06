import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mockStore } from "@/lib/mocks/store";

export async function POST(request: NextRequest) {
  // Reset mock state store
  mockStore.reset();

  // Clear mock session cookie
  const cookieStore = await cookies();
  cookieStore.delete("SESSION");

  return NextResponse.json({ success: true });
}
