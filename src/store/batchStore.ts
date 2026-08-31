import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FolderInfo } from '@/app/_component/batch/FolderInfoCard';

interface BatchState {
    folders: FolderInfo[];
}

const initialState: BatchState = {
    folders: [],
};

/**
 * Batch folder selection state (was `batchSlice` in Redux) — not persisted.
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 */
export const useBatchStore = create<BatchState>()(immer(() => initialState));

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function setFolders(folders: FolderInfo[]) {
    useBatchStore.setState((state) => {
        state.folders = folders;
    });
}

export function addFolder(folder: FolderInfo) {
    useBatchStore.setState((state) => {
        state.folders.push(folder);
    });
}

export function updateFolder(id: string, updates: Partial<FolderInfo>) {
    useBatchStore.setState((state) => {
        const index = state.folders.findIndex((f) => f.id === id);
        if (index !== -1) {
            state.folders[index] = { ...state.folders[index], ...updates };
        }
    });
}

export function removeFolder(id: string) {
    useBatchStore.setState((state) => {
        state.folders = state.folders.filter((f) => f.id !== id);
    });
}

export function clearFolders() {
    useBatchStore.setState((state) => {
        state.folders = [];
    });
}
