import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ThumbnailData = {
    file: File;
    thumbnailUrl: string;
    previewUrl?: string | null;
};

interface FileState {
    files: File[];
    filePaths: Map<File, string>;
    thumbnails: ThumbnailData[];
    isGeneratingThumbnails: boolean;
    pendingThumbnailCount: number;
    selectedFile: File | null;
}

const initialState: FileState = {
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
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 */
export const useFileStore = create<FileState>()(immer(() => initialState));

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function setFiles(files: File[]) {
    useFileStore.setState((state) => {
        state.files = files;
    });
}

export function addFiles(files: File[]) {
    useFileStore.setState((state) => {
        state.files.push(...files);
    });
}

export function removeFile(file: File) {
    useFileStore.setState((state) => {
        state.files = state.files.filter((f) => f !== file);
        state.thumbnails = state.thumbnails.filter((t) => t.file !== file);
        state.filePaths.delete(file);
        if (state.selectedFile === file) {
            state.selectedFile = null;
        }
    });
}

export function setFilePath(file: File, path: string) {
    useFileStore.setState((state) => {
        state.filePaths.set(file, path);
    });
}

export function setFilePaths(paths: Map<File, string>) {
    useFileStore.setState((state) => {
        state.filePaths = paths;
    });
}

export function setThumbnails(thumbnails: ThumbnailData[]) {
    useFileStore.setState((state) => {
        state.thumbnails = thumbnails;
    });
}

export function addThumbnail(thumbnail: ThumbnailData) {
    useFileStore.setState((state) => {
        // Check if exists
        const index = state.thumbnails.findIndex((t) => t.file === thumbnail.file);
        if (index !== -1) {
            state.thumbnails[index] = thumbnail;
        } else {
            state.thumbnails.push(thumbnail);
        }
    });
}

export function setIsGeneratingThumbnails(generating: boolean) {
    useFileStore.setState((state) => {
        state.isGeneratingThumbnails = generating;
    });
}

export function setPendingThumbnailCount(count: number) {
    useFileStore.setState((state) => {
        state.pendingThumbnailCount = count;
    });
}

export function setSelectedFile(file: File | null) {
    useFileStore.setState((state) => {
        state.selectedFile = file;
    });
}

export function clearThumbnails() {
    useFileStore.setState((state) => {
        state.thumbnails = [];
        state.pendingThumbnailCount = 0;
        state.isGeneratingThumbnails = false;
    });
}

// Bulk action for efficient batch updates - O(N) instead of O(N²)
export function upsertThumbnails(items: ThumbnailData[]) {
    useFileStore.setState((state) => {
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
    });
}

// ===================== Non-reactive helpers =====================

/** Look up a file's stored path without subscribing to the store. */
export function getFilePath(file: File): string | undefined {
    return useFileStore.getState().filePaths.get(file);
}
