import { NextRequest, NextResponse } from "next/server";
import { mockStore } from "@/lib/mocks/store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = mockStore.getJob(id);

  if (!job) {
    return NextResponse.json(
      { error: "job_not_found", message: "No transfer job found with the specified ID" },
      { status: 404 }
    );
  }

  // Return full job details matching contract
  return NextResponse.json({
    id: job.id,
    status: job.status,
    transferMode: job.transferMode,
    conflictPolicy: job.conflictPolicy,
    totalFiles: job.totalFiles,
    totalFolders: job.totalFolders,
    filesCompleted: job.filesCompleted,
    filesFailed: job.filesFailed,
    foldersCreated: job.foldersCreated,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
}
