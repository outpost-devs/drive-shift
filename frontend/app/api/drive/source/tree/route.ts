import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function GET(request: NextRequest) {
  // Check source drive connection status
  if (!mockStore.isSourceConnected) {
    return NextResponse.json(
      { error: "source_not_connected", message: "Please connect a Source account" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const folderId = searchParams.get("folderId") || undefined;

  const tree = mockStore.getSourceTree(folderId);
  return NextResponse.json(tree);
}
