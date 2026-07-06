import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const itemsRequeued = mockStore.retryFailedJob(id);

  if (itemsRequeued === 0) {
    return NextResponse.json(
      { error: "invalid_state", message: "Only completed with errors or failed jobs can be retried, and there must be failed items" },
      { status: 400 }
    );
  }

  return NextResponse.json({ id, status: "running", itemsRequeued });
}
