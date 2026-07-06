import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transferMode, conflictPolicy, sourceItemIds, targetParentId } = body;

    // Validate parameters
    if (!transferMode || !conflictPolicy || !sourceItemIds || !targetParentId) {
      return NextResponse.json(
        { error: "bad_request", message: "Missing required parameters in request body" },
        { status: 400 }
      );
    }

    if (transferMode !== "COPY" && transferMode !== "MOVE") {
      return NextResponse.json(
        { error: "invalid_mode", message: "transferMode must be COPY or MOVE" },
        { status: 400 }
      );
    }

    // Simulate quota check (if source items size exceeds ~6.4GB, return error 402 as in contract)
    // Here we'll just succeed normally unless custom testing inputs are sent
    const isQuotaError = sourceItemIds.includes("trigger-quota-error");
    if (isQuotaError) {
      return NextResponse.json(
        {
          error: "insufficient_target_quota",
          requiredBytes: 6400000000,
          availableBytes: 5000000000
        },
        { status: 402 }
      );
    }

    const newJob = mockStore.createJob(transferMode, conflictPolicy, sourceItemIds, targetParentId);
    return NextResponse.json({
      id: newJob.id,
      status: newJob.status,
      transferMode: newJob.transferMode,
      totalFiles: newJob.totalFiles,
      totalFolders: newJob.totalFolders,
      createdAt: newJob.createdAt
    }, { status: 201 });

  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Malformed JSON request body" },
      { status: 400 }
    );
  }
}
