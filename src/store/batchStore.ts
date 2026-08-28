import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FolderInfo } from '@/app/_component/batch/FolderInfoCard';

interface BatchData {
    folders: FolderInfo[];
}

interface BatchStore extends BatchData {
    setFolders: (folders: FolderInfo[]) => void;
    addFolder: (folder: FolderInfo) => void;
    updateFolder: (payload: { id: string; updates: Partial<FolderInfo> }) => void;
    removeFolder: (id: string) => void;
    clearFolders: () => void;
}

const initialState: BatchData = {
    folders: [],
};

/** Batch folder selection state (was `batchSlice` in Redux) — not persisted. */
export const useBatchStore = create<BatchStore>()(
    immer((set) => ({
        ...initialState,

        setFolders: (folders) =>
            set((state) => {
                state.folders = folders;
            }),

        addFolder: (folder) =>
            set((state) => {
                state.folders.push(folder);
            }),

        updateFolder: (payload) =>
            set((state) => {
                const index = state.folders.findIndex((f) => f.id === payload.id);
                if (index !== -1) {
                    state.folders[index] = { ...state.folders[index], ...payload.updates };
                }
            }),

        removeFolder: (id) =>
            set((state) => {
                state.folders = state.folders.filter((f) => f.id !== id);
            }),

        clearFolders: () =>
            set((state) => {
                state.folders = [];
            }),
    }))
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const setFolders = useBatchStore.getState().setFolders;
export const addFolder = useBatchStore.getState().addFolder;
export const updateFolder = useBatchStore.getState().updateFolder;
export const removeFolder = useBatchStore.getState().removeFolder;
export const clearFolders = useBatchStore.getState().clearFolders;
