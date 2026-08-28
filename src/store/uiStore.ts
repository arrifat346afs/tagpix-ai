import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type GenerationProgress = {
    isGenerating: boolean;
    currentIndex: number;
    currentFileName: string;
    totalFiles: number;
    cancelRequested: boolean;
};

interface UiData {
    settingsDialog: {
        isOpen: boolean;
        defaultTab: string;
    };
    generationProgress: GenerationProgress;
    hasAttemptedGeneration: boolean;
    activeLeftTab: 'category' | 'log';
}

interface UiStore extends UiData {
    setSettingsDialogOpen: (open: boolean) => void;
    setSettingsDialogTab: (tab: string) => void;
    setGenerationProgress: (progress: Partial<GenerationProgress>) => void;
    setHasAttemptedGeneration: (attempted: boolean) => void;
    setActiveLeftTab: (tab: 'category' | 'log') => void;
}

const initialState: UiData = {
    settingsDialog: {
        isOpen: false,
        defaultTab: 'models',
    },
    generationProgress: {
        isGenerating: false,
        currentIndex: 0,
        currentFileName: '',
        totalFiles: 0,
        cancelRequested: false,
    },
    hasAttemptedGeneration: false,
    activeLeftTab: 'category',
};

/** Transient UI state (was `uiSlice` in Redux) — not persisted. */
export const useUiStore = create<UiStore>()(
    immer((set) => ({
        ...initialState,

        setSettingsDialogOpen: (open) =>
            set((state) => {
                state.settingsDialog.isOpen = open;
            }),

        setSettingsDialogTab: (tab) =>
            set((state) => {
                state.settingsDialog.defaultTab = tab;
            }),

        setGenerationProgress: (progress) =>
            set((state) => {
                state.generationProgress = { ...state.generationProgress, ...progress };
            }),

        setHasAttemptedGeneration: (attempted) =>
            set((state) => {
                state.hasAttemptedGeneration = attempted;
            }),

        setActiveLeftTab: (tab) =>
            set((state) => {
                state.activeLeftTab = tab;
            }),
    }))
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const setSettingsDialogOpen = useUiStore.getState().setSettingsDialogOpen;
export const setSettingsDialogTab = useUiStore.getState().setSettingsDialogTab;
export const setGenerationProgress = useUiStore.getState().setGenerationProgress;
export const setHasAttemptedGeneration = useUiStore.getState().setHasAttemptedGeneration;
export const setActiveLeftTab = useUiStore.getState().setActiveLeftTab;
