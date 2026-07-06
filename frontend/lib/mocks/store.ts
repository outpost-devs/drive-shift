export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface DriveItem {
  id: string;
  name: string;
  type: "folder" | "file";
  mimeType: string;
  sizeBytes: number | null;
  parentId?: string;
}

export interface TransferJob {
  id: string;
  status: "pending" | "running" | "paused" | "completed" | "completed_with_errors" | "failed" | "cancelled";
  transferMode: "COPY" | "MOVE";
  conflictPolicy: "skip" | "rename" | "overwrite";
  totalFiles: number;
  totalFolders: number;
  filesCompleted: number;
  filesFailed: number;
  foldersCreated: number;
  createdAt: string;
  updatedAt: string;
  // Progress stream listeners
  listeners?: ((event: { type: string; data: string }) => void)[];
}

class MockStore {
  public isSourceConnected = false;
  public isTargetConnected = false;
  public isLoggedIn = false;

  private sourceItems: DriveItem[] = [
    { id: "root", name: "My Drive", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null },
    { id: "folder-projects", name: "Projects", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null, parentId: "root" },
    { id: "folder-photos", name: "Photos", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null, parentId: "root" },
    { id: "file-resume", name: "resume.pdf", type: "file", mimeType: "application/pdf", sizeBytes: 245760, parentId: "root" },
    { id: "file-budget", name: "budget.xlsx", type: "file", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 1048576, parentId: "root" },
    
    // Under Projects
    { id: "folder-driveshift", name: "Drive-Shift", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null, parentId: "folder-projects" },
    { id: "file-api-spec", name: "api_spec.json", type: "file", mimeType: "application/json", sizeBytes: 45000, parentId: "folder-projects" },
    
    // Under Photos
    { id: "file-avatar", name: "avatar.jpg", type: "file", mimeType: "image/jpeg", sizeBytes: 512000, parentId: "folder-photos" }
  ];

  private targetItems: DriveItem[] = [
    { id: "root", name: "Target Drive", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null },
    { id: "target-backups", name: "Backups", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null, parentId: "root" },
    { id: "target-archive", name: "Archive", type: "folder", mimeType: "application/vnd.google-apps.folder", sizeBytes: null, parentId: "root" }
  ];

  private targetQuota = {
    usedBytes: 9663676416,
    totalBytes: 16106127360,
    percentUsed: 60
  };

  private jobs = new Map<string, TransferJob>();

  // Reset store (for logout)
  public reset() {
    this.isSourceConnected = false;
    this.isTargetConnected = false;
    this.isLoggedIn = false;
    this.jobs.clear();
  }

  // Get source directory contents
  public getSourceTree(folderId?: string) {
    const targetFolderId = folderId || "root";
    const breadcrumb = this.getBreadcrumbs(this.sourceItems, targetFolderId);
    const items = this.sourceItems.filter(item => item.parentId === targetFolderId);
    return { folderId: targetFolderId, breadcrumb, items };
  }

  // Get target directories (only folders)
  public getTargetFolders(parentId?: string) {
    const targetParentId = parentId || "root";
    const breadcrumb = this.getBreadcrumbs(this.targetItems, targetParentId);
    const items = this.targetItems.filter(item => item.parentId === targetParentId && item.type === "folder");
    return { folderId: targetParentId, breadcrumb, items };
  }

  // Create new folder in target drive
  public createTargetFolder(parentId: string, name: string): DriveItem {
    const id = `folder-${Math.random().toString(36).substring(2, 9)}`;
    const newFolder: DriveItem = {
      id,
      name,
      type: "folder",
      mimeType: "application/vnd.google-apps.folder",
      sizeBytes: null,
      parentId
    };
    this.targetItems.push(newFolder);
    return newFolder;
  }

  // Get target storage quota
  public getTargetQuota() {
    return this.targetQuota;
  }

  // Create a transfer job
  public createJob(transferMode: "COPY" | "MOVE", conflictPolicy: "skip" | "rename" | "overwrite", sourceItemIds: string[], _targetParentId: string): TransferJob {
    void _targetParentId;
    const id = `job-${Math.random().toString(36).substring(2, 15)}`;
    
    // Estimate files/folders count based on selection
    let totalFiles = 0;
    let totalFolders = 0;
    sourceItemIds.forEach(itemId => {
      const item = this.sourceItems.find(i => i.id === itemId);
      if (item) {
        if (item.type === "file") totalFiles++;
        else {
          totalFolders++;
          // Add children recursively in simulation
          const children = this.sourceItems.filter(i => i.parentId === itemId);
          children.forEach(c => {
            if (c.type === "file") totalFiles++;
            else totalFolders++;
          });
        }
      }
    });

    const newJob: TransferJob = {
      id,
      status: "pending",
      transferMode,
      conflictPolicy,
      totalFiles: totalFiles || 5, // fallback if empty
      totalFolders,
      filesCompleted: 0,
      filesFailed: 0,
      foldersCreated: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      listeners: []
    };

    this.jobs.set(id, newJob);
    
    // Start background simulation
    this.simulateJobProgress(id);

    return newJob;
  }

  // Get active job
  public getJob(id: string): TransferJob | undefined {
    return this.jobs.get(id);
  }

  // Action methods
  public pauseJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (job && job.status === "running") {
      job.status = "paused";
      job.updatedAt = new Date().toISOString();
      this.broadcastToJob(id, "progress", {
        item: "Job Paused",
        status: "paused",
        filesCompleted: job.filesCompleted,
        totalFiles: job.totalFiles
      });
      return true;
    }
    return false;
  }

  public resumeJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (job && job.status === "paused") {
      job.status = "running";
      job.updatedAt = new Date().toISOString();
      this.broadcastToJob(id, "progress", {
        item: "Job Resumed",
        status: "running",
        filesCompleted: job.filesCompleted,
        totalFiles: job.totalFiles
      });
      this.simulateJobProgress(id);
      return true;
    }
    return false;
  }

  public cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (job && (job.status === "running" || job.status === "paused" || job.status === "pending")) {
      job.status = "cancelled";
      job.updatedAt = new Date().toISOString();
      this.broadcastToJob(id, "done", {
        status: "cancelled",
        filesCompleted: job.filesCompleted,
        filesFailed: job.filesFailed,
        totalFiles: job.totalFiles
      });
      return true;
    }
    return false;
  }

  public retryFailedJob(id: string): number {
    const job = this.jobs.get(id);
    if (job && (job.status === "failed" || job.status === "completed_with_errors")) {
      const requeuedCount = job.filesFailed;
      job.filesFailed = 0;
      job.status = "running";
      job.updatedAt = new Date().toISOString();
      this.broadcastToJob(id, "progress", {
        item: "Retrying failed items",
        status: "running",
        filesCompleted: job.filesCompleted,
        totalFiles: job.totalFiles
      });
      this.simulateJobProgress(id);
      return requeuedCount;
    }
    return 0;
  }

  // Subscribe to progress events
  public subscribeToJob(id: string, listener: (event: { type: string; data: string }) => void) {
    const job = this.jobs.get(id);
    if (job) {
      if (!job.listeners) job.listeners = [];
      job.listeners.push(listener);
    }
  }

  // Unsubscribe
  public unsubscribeFromJob(id: string, listener: (event: { type: string; data: string }) => void) {
    const job = this.jobs.get(id);
    if (job && job.listeners) {
      job.listeners = job.listeners.filter(l => l !== listener);
    }
  }

  // Simulate background job progress
  private simulateJobProgress(id: string) {
    const interval = setInterval(() => {
      const job = this.jobs.get(id);
      if (!job || job.status !== "running" && job.status !== "pending") {
        clearInterval(interval);
        return;
      }

      if (job.status === "pending") {
        job.status = "running";
        job.updatedAt = new Date().toISOString();
      }

      // Simulate folders creation first
      if (job.foldersCreated < job.totalFolders) {
        job.foldersCreated++;
        job.updatedAt = new Date().toISOString();
        this.broadcastToJob(id, "progress", {
          item: `Created folder ${job.foldersCreated} of ${job.totalFolders}`,
          status: "running",
          filesCompleted: job.filesCompleted,
          totalFiles: job.totalFiles
        });
        return;
      }

      // Simulate file progress
      if (job.filesCompleted + job.filesFailed < job.totalFiles) {
        // 95% success rate, 5% failure rate
        const isSuccess = Math.random() > 0.05;
        const fileIndex = job.filesCompleted + job.filesFailed + 1;
        const filename = `file_${fileIndex}.dat`;

        if (isSuccess) {
          job.filesCompleted++;
        } else {
          job.filesFailed++;
        }
        job.updatedAt = new Date().toISOString();

        if (isSuccess) {
          this.broadcastToJob(id, "progress", {
            item: filename,
            status: "completed",
            filesCompleted: job.filesCompleted,
            totalFiles: job.totalFiles
          });
        } else {
          this.broadcastToJob(id, "progress", {
            item: filename,
            status: "failed",
            filesCompleted: job.filesCompleted,
            totalFiles: job.totalFiles,
            error: "rate_limited"
          });
        }
      } else {
        // Simulation completed
        clearInterval(interval);
        job.status = job.filesFailed > 0 ? "completed_with_errors" : "completed";
        job.updatedAt = new Date().toISOString();
        this.broadcastToJob(id, "done", {
          status: job.status,
          filesCompleted: job.filesCompleted,
          filesFailed: job.filesFailed,
          totalFiles: job.totalFiles
        });
      }
    }, 1500); // Progress tick every 1.5 seconds
  }

  private broadcastToJob(id: string, type: string, dataObj: Record<string, unknown>) {
    const job = this.jobs.get(id);
    if (job && job.listeners) {
      const eventStr = JSON.stringify(dataObj);
      job.listeners.forEach(listener => {
        listener({ type, data: eventStr });
      });
    }
  }

  // Utility to generate breadcrumbs
  private getBreadcrumbs(items: DriveItem[], folderId: string): BreadcrumbItem[] {
    const breadcrumb: BreadcrumbItem[] = [];
    let currentId = folderId;

    while (currentId) {
      const item = items.find(i => i.id === currentId);
      if (!item) break;
      breadcrumb.unshift({ id: item.id, name: item.name });
      currentId = item.parentId || "";
    }

    return breadcrumb;
  }
}

// Global single instance of our mock store
export const mockStore = new MockStore();
export default mockStore;
