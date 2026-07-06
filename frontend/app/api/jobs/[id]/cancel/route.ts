import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const success = mockStore.cancelJob(id);

  if (!success) {
    return NextResponse.json(
      { error: "invalid_state", message: "Only running, paused, or pending jobs can be cancelled" },
      { status: 400 }
    );
  }

  return NextResponse.json({ id, status: "cancelled" });
}
