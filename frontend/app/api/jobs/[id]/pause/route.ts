import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const success = mockStore.pauseJob(id);

  if (!success) {
    return NextResponse.json(
      { error: "invalid_state", message: "Only running jobs can be paused" },
      { status: 400 }
    );
  }

  return NextResponse.json({ id, status: "paused" });
}
