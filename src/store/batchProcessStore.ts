import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FolderInfo } from '@/app/_component/batch/FolderInfoCard';
import type { GeneratedMetadata } from '@/app/lib/ai';

export type BatchProcessStatus =
  | 'idle'
  | 'scanning'
  | 'processing'
  | 'embedding'
  | 'exporting'
  | 'completed'
  | 'paused'
  | 'error';

export type ImageProcessingState = {
  fileName: string;
  filePath: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  metadata?: GeneratedMetadata;
  error?: string;
};

export type FolderProcessingState = {
  folderId: string;
  folderPath: string;
  folderName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  images: ImageProcessingState[];
  currentImageIndex: number;
  assignedTemplateId: string | null;
  error?: string;
  exportedFilePath?: string;
};

export type BatchProcessState = {
  isProcessing: boolean;
  overallStatus: BatchProcessStatus;
  currentFolderIndex: number;
  totalFolders: number;
  totalImages: number;
  completedImages: number;
  failedImages: number;
  folders: FolderProcessingState[];
  startTime?: number;
  error?: string;
  processingMode: 'sequential' | 'parallel';
  currentStage: 'ai_generation' | 'metadata_embedding' | 'exporting' | null;
};

const initialState: BatchProcessState = {
  isProcessing: false,
  overallStatus: 'idle',
  currentFolderIndex: 0,
  totalFolders: 0,
  totalImages: 0,
  completedImages: 0,
  failedImages: 0,
  folders: [],
  processingMode: 'sequential',
  currentStage: null,
};

/**
 * Live batch-processing progress (was `batchProcessSlice` in Redux) — not persisted.
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 */
export const useBatchProcessStore = create<BatchProcessState>()(immer(() => initialState));

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function startBatchProcess(folders: FolderInfo[], processingMode: 'sequential' | 'parallel') {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = true;
    state.overallStatus = 'scanning';
    state.processingMode = processingMode;
    state.currentFolderIndex = 0;
    state.totalFolders = folders.length;
    state.totalImages = folders.reduce((acc, f) => acc + f.imageCount, 0);
    state.completedImages = 0;
    state.failedImages = 0;
    state.startTime = Date.now();
    state.error = undefined;
    state.currentStage = null;

    state.folders = folders.map((folder, index) => ({
      folderId: folder.id,
      folderPath: folder.folderPath,
      folderName: folder.folderPath.split(/[/\\]/).pop() || 'Unknown',
      status: index === 0 ? 'processing' : 'pending',
      images: folder.files
        .filter((f) => f.type.startsWith('image/'))
        .map((file) => ({
          fileName: file.name,
          filePath: '', // Will be populated when processing
          status: 'pending' as const,
        })),
      currentImageIndex: 0,
      assignedTemplateId: folder.assignedTemplateId,
    }));
  });
}

export function updateFolderStatus(
  folderId: string,
  status: FolderProcessingState['status'],
  error?: string
) {
  useBatchProcessStore.setState((state) => {
    const folder = state.folders.find((f) => f.folderId === folderId);
    if (folder) {
      folder.status = status;
      if (error) {
        folder.error = error;
      }
    }
  });
}

export function updateImageStatus(
  folderId: string,
  fileName: string,
  status: ImageProcessingState['status'],
  metadata?: GeneratedMetadata,
  error?: string
) {
  useBatchProcessStore.setState((state) => {
    const folder = state.folders.find((f) => f.folderId === folderId);
    if (folder) {
      const image = folder.images.find((img) => img.fileName === fileName);
      if (image) {
        image.status = status;
        if (metadata) {
          image.metadata = metadata;
        }
        if (error) {
          image.error = error;
        }
      }
    }

    // Update counters
    if (status === 'completed') {
      state.completedImages++;
    } else if (status === 'error') {
      state.failedImages++;
    }
  });
}

export function setCurrentStage(stage: BatchProcessState['currentStage']) {
  useBatchProcessStore.setState((state) => {
    state.currentStage = stage;
    if (stage === 'ai_generation') {
      state.overallStatus = 'processing';
    } else if (stage === 'metadata_embedding') {
      state.overallStatus = 'embedding';
    } else if (stage === 'exporting') {
      state.overallStatus = 'exporting';
    }
  });
}

export function setCurrentFolderIndex(index: number) {
  useBatchProcessStore.setState((state) => {
    state.currentFolderIndex = index;

    // Update folder statuses
    state.folders.forEach((folder, folderIndex) => {
      if (folderIndex < index) {
        folder.status = 'completed';
      } else if (folderIndex === index) {
        folder.status = 'processing';
      } else {
        folder.status = 'pending';
      }
    });
  });
}

export function updateImageProgress(folderId: string, currentImageIndex: number) {
  useBatchProcessStore.setState((state) => {
    const folder = state.folders.find((f) => f.folderId === folderId);
    if (folder) {
      folder.currentImageIndex = currentImageIndex;
    }
  });
}

export function markFolderExported(folderId: string, exportedFilePath: string) {
  useBatchProcessStore.setState((state) => {
    const folder = state.folders.find((f) => f.folderId === folderId);
    if (folder) {
      folder.exportedFilePath = exportedFilePath;
    }
  });
}

export function completeBatchProcess() {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = false;
    state.overallStatus = 'completed';
    state.currentStage = null;
  });
}

export function pauseBatchProcess() {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = false;
    state.overallStatus = 'paused';
  });
}

export function resumeBatchProcess() {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = true;
    state.overallStatus = 'processing';
  });
}

// Copies saved batch-progress fields (from localStorage) into the store so
// resumed runs show the restored folders/counters instead of stale state.
export function restoreBatchProcess(saved: BatchProcessState) {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = saved.isProcessing;
    state.overallStatus = saved.overallStatus;
    state.currentFolderIndex = saved.currentFolderIndex;
    state.totalFolders = saved.totalFolders;
    state.totalImages = saved.totalImages;
    state.completedImages = saved.completedImages;
    state.failedImages = saved.failedImages;
    state.folders = saved.folders;
    state.processingMode = saved.processingMode;
    state.currentStage = null;
    state.error = undefined;
    state.startTime = undefined;
  });
}

export function failBatchProcess(error: string) {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = false;
    state.overallStatus = 'error';
    state.error = error;
  });
}

export function cancelBatchProcess() {
  useBatchProcessStore.setState((state) => {
    state.isProcessing = false;
    state.overallStatus = 'idle';
    state.currentStage = null;
  });
}

export function resetBatchProcess() {
  useBatchProcessStore.setState((state) => {
    Object.assign(state, initialState);
  });
}

export function updateFilePath(folderId: string, fileName: string, filePath: string) {
  useBatchProcessStore.setState((state) => {
    const folder = state.folders.find((f) => f.folderId === folderId);
    if (folder) {
      const image = folder.images.find((img) => img.fileName === fileName);
      if (image) {
        image.filePath = filePath;
      }
    }
  });
}
