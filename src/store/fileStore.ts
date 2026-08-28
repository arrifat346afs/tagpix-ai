import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ThumbnailData = {
    file: File;
    thumbnailUrl: string;
    previewUrl?: string | null;
};

interface FileData {
    files: File[];
    filePaths: Map<File, string>;
    thumbnails: ThumbnailData[];
    isGeneratingThumbnails: boolean;
    pendingThumbnailCount: number;
    selectedFile: File | null;
}

interface FileStore extends FileData {
    setFiles: (files: File[]) => void;
    addFiles: (files: File[]) => void;
    removeFile: (file: File) => void;
    setFilePath: (payload: { file: File; path: string }) => void;
    setFilePaths: (paths: Map<File, string>) => void;
    setThumbnails: (thumbnails: ThumbnailData[]) => void;
    addThumbnail: (thumbnail: ThumbnailData) => void;
    setIsGeneratingThumbnails: (generating: boolean) => void;
    setPendingThumbnailCount: (count: number) => void;
    setSelectedFile: (file: File | null) => void;
    clearThumbnails: () => void;
    upsertThumbnails: (items: ThumbnailData[]) => void;
}

const initialState: FileData = {
    files: [],
    filePaths: new Map(),
    thumbnails: [],
    isGeneratingThumbnails: false,
    pendingThumbnailCount: 0,
    selectedFile: null,
};

/**
 * Uploaded files, file paths (Map), and thumbnails (was `fileSlice` in Redux).
 * Not persisted — unlike Redux, Zustand has no serializability middleware, so
 * `File` objects and `Map`s can live here directly. Requires immer's
 * `enableMapSet()` (called in `src/store/init.ts`) for Map drafts.
 */
export const useFileStore = create<FileStore>()(
    immer((set) => ({
        ...initialState,

        setFiles: (files) =>
            set((state) => {
                state.files = files;
            }),

        addFiles: (files) =>
            set((state) => {
                state.files.push(...files);
            }),

        removeFile: (file) =>
            set((state) => {
                state.files = state.files.filter((f) => f !== file);
                state.thumbnails = state.thumbnails.filter((t) => t.file !== file);
                state.filePaths.delete(file);
                if (state.selectedFile === file) {
                    state.selectedFile = null;
                }
            }),

        setFilePath: (payload) =>
            set((state) => {
                state.filePaths.set(payload.file, payload.path);
            }),

        setFilePaths: (paths) =>
            set((state) => {
                state.filePaths = paths;
            }),

        setThumbnails: (thumbnails) =>
            set((state) => {
                state.thumbnails = thumbnails;
            }),

        addThumbnail: (thumbnail) =>
            set((state) => {
                // Check if exists
                const index = state.thumbnails.findIndex((t) => t.file === thumbnail.file);
                if (index !== -1) {
                    state.thumbnails[index] = thumbnail;
                } else {
                    state.thumbnails.push(thumbnail);
                }
            }),

        setIsGeneratingThumbnails: (generating) =>
            set((state) => {
                state.isGeneratingThumbnails = generating;
            }),

        setPendingThumbnailCount: (count) =>
            set((state) => {
                state.pendingThumbnailCount = count;
            }),

        setSelectedFile: (file) =>
            set((state) => {
                state.selectedFile = file;
            }),

        clearThumbnails: () =>
            set((state) => {
                state.thumbnails = [];
                state.pendingThumbnailCount = 0;
                state.isGeneratingThumbnails = false;
            }),

        // Bulk action for efficient batch updates - O(N) instead of O(N²)
        upsertThumbnails: (items) =>
            set((state) => {
                if (items.length === 0) return;

                // Build index map for O(1) lookups
                const fileToIndex = new Map<File, number>();
                state.thumbnails.forEach((t, i) => fileToIndex.set(t.file, i));

                items.forEach((item) => {
                    const existingIndex = fileToIndex.get(item.file);
                    if (existingIndex !== undefined) {
                        state.thumbnails[existingIndex] = item;
                    } else {
                        state.thumbnails.push(item);
                        fileToIndex.set(item.file, state.thumbnails.length - 1);
                    }
                });
            }),
    }))
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const setFiles = useFileStore.getState().setFiles;
export const addFiles = useFileStore.getState().addFiles;
export const removeFile = useFileStore.getState().removeFile;
export const setFilePath = useFileStore.getState().setFilePath;
export const setFilePaths = useFileStore.getState().setFilePaths;
export const setThumbnails = useFileStore.getState().setThumbnails;
export const addThumbnail = useFileStore.getState().addThumbnail;
export const setIsGeneratingThumbnails = useFileStore.getState().setIsGeneratingThumbnails;
export const setPendingThumbnailCount = useFileStore.getState().setPendingThumbnailCount;
export const setSelectedFile = useFileStore.getState().setSelectedFile;
export const clearThumbnails = useFileStore.getState().clearThumbnails;
export const upsertThumbnails = useFileStore.getState().upsertThumbnails;
