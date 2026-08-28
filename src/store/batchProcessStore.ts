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

interface BatchProcessStore extends BatchProcessState {
  startBatchProcess: (payload: { folders: FolderInfo[]; processingMode: 'sequential' | 'parallel' }) => void;
  updateFolderStatus: (payload: {
    folderId: string;
    status: FolderProcessingState['status'];
    error?: string;
  }) => void;
  updateImageStatus: (payload: {
    folderId: string;
    fileName: string;
    status: ImageProcessingState['status'];
    metadata?: GeneratedMetadata;
    error?: string;
  }) => void;
  setCurrentStage: (stage: BatchProcessState['currentStage']) => void;
  setCurrentFolderIndex: (index: number) => void;
  updateImageProgress: (payload: { folderId: string; currentImageIndex: number }) => void;
  markFolderExported: (payload: { folderId: string; exportedFilePath: string }) => void;
  completeBatchProcess: () => void;
  pauseBatchProcess: () => void;
  resumeBatchProcess: () => void;
  failBatchProcess: (error: string) => void;
  cancelBatchProcess: () => void;
  resetBatchProcess: () => void;
  updateFilePath: (payload: { folderId: string; fileName: string; filePath: string }) => void;
}

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

/** Live batch-processing progress (was `batchProcessSlice` in Redux) — not persisted. */
export const useBatchProcessStore = create<BatchProcessStore>()(
  immer((set) => ({
    ...initialState,

    startBatchProcess: (payload) =>
      set((state) => {
        const { folders, processingMode } = payload;

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
              status: 'pending',
            })),
          currentImageIndex: 0,
          assignedTemplateId: folder.assignedTemplateId,
        }));
      }),

    updateFolderStatus: (payload) =>
      set((state) => {
        const folder = state.folders.find((f) => f.folderId === payload.folderId);
        if (folder) {
          folder.status = payload.status;
          if (payload.error) {
            folder.error = payload.error;
          }
        }
      }),

    updateImageStatus: (payload) =>
      set((state) => {
        const folder = state.folders.find((f) => f.folderId === payload.folderId);
        if (folder) {
          const image = folder.images.find((img) => img.fileName === payload.fileName);
          if (image) {
            image.status = payload.status;
            if (payload.metadata) {
              image.metadata = payload.metadata;
            }
            if (payload.error) {
              image.error = payload.error;
            }
          }
        }

        // Update counters
        if (payload.status === 'completed') {
          state.completedImages++;
        } else if (payload.status === 'error') {
          state.failedImages++;
        }
      }),

    setCurrentStage: (stage) =>
      set((state) => {
        state.currentStage = stage;
        if (stage === 'ai_generation') {
          state.overallStatus = 'processing';
        } else if (stage === 'metadata_embedding') {
          state.overallStatus = 'embedding';
        } else if (stage === 'exporting') {
          state.overallStatus = 'exporting';
        }
      }),

    setCurrentFolderIndex: (index) =>
      set((state) => {
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
      }),

    updateImageProgress: (payload) =>
      set((state) => {
        const folder = state.folders.find((f) => f.folderId === payload.folderId);
        if (folder) {
          folder.currentImageIndex = payload.currentImageIndex;
        }
      }),

    markFolderExported: (payload) =>
      set((state) => {
        const folder = state.folders.find((f) => f.folderId === payload.folderId);
        if (folder) {
          folder.exportedFilePath = payload.exportedFilePath;
        }
      }),

    completeBatchProcess: () =>
      set((state) => {
        state.isProcessing = false;
        state.overallStatus = 'completed';
        state.currentStage = null;
      }),

    pauseBatchProcess: () =>
      set((state) => {
        state.isProcessing = false;
        state.overallStatus = 'paused';
      }),

    resumeBatchProcess: () =>
      set((state) => {
        state.isProcessing = true;
        state.overallStatus = 'processing';
      }),

    failBatchProcess: (error) =>
      set((state) => {
        state.isProcessing = false;
        state.overallStatus = 'error';
        state.error = error;
      }),

    cancelBatchProcess: () =>
      set((state) => {
        state.isProcessing = false;
        state.overallStatus = 'idle';
        state.currentStage = null;
      }),

    resetBatchProcess: () =>
      set((state) => {
        // Restore data fields while keeping the action functions intact
        Object.assign(state, initialState);
      }),

    updateFilePath: (payload) =>
      set((state) => {
        const folder = state.folders.find((f) => f.folderId === payload.folderId);
        if (folder) {
          const image = folder.images.find((img) => img.fileName === payload.fileName);
          if (image) {
            image.filePath = payload.filePath;
          }
        }
      }),
  }))
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const startBatchProcess = useBatchProcessStore.getState().startBatchProcess;
export const updateFolderStatus = useBatchProcessStore.getState().updateFolderStatus;
export const updateImageStatus = useBatchProcessStore.getState().updateImageStatus;
export const setCurrentStage = useBatchProcessStore.getState().setCurrentStage;
export const setCurrentFolderIndex = useBatchProcessStore.getState().setCurrentFolderIndex;
export const updateImageProgress = useBatchProcessStore.getState().updateImageProgress;
export const markFolderExported = useBatchProcessStore.getState().markFolderExported;
export const completeBatchProcess = useBatchProcessStore.getState().completeBatchProcess;
export const pauseBatchProcess = useBatchProcessStore.getState().pauseBatchProcess;
export const resumeBatchProcess = useBatchProcessStore.getState().resumeBatchProcess;
export const failBatchProcess = useBatchProcessStore.getState().failBatchProcess;
export const cancelBatchProcess = useBatchProcessStore.getState().cancelBatchProcess;
export const resetBatchProcess = useBatchProcessStore.getState().resetBatchProcess;
export const updateFilePath = useBatchProcessStore.getState().updateFilePath;


