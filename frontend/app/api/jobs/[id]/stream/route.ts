import { NextRequest } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = mockStore.getJob(id);

  if (!job) {
    return new Response(
      JSON.stringify({ error: "job_not_found", message: "No job found to stream" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      // Define listener to capture events from our mock store
      const listener = (event: { type: string; data: string }) => {
        const payload = `event: ${event.type}\ndata: ${event.data}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // If connection closed, unsubscribe listener
          mockStore.unsubscribeFromJob(id, listener);
        }
      };

      // Subscribe to updates from our global mock database
      mockStore.subscribeToJob(id, listener);

      // Send initial connection event
      const initialPayload = `event: progress\ndata: ${JSON.stringify({
        item: "Establishing SSE connection...",
        status: job.status,
        filesCompleted: job.filesCompleted,
        totalFiles: job.totalFiles
      })}\n\n`;
      controller.enqueue(encoder.encode(initialPayload));

      // Handle client disconnect (aborted request)
      request.signal.addEventListener("abort", () => {
        mockStore.unsubscribeFromJob(id, listener);
        try {
          controller.close();
        } catch {}
      });
    }
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
