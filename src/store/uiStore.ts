import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type GenerationProgress = {
    isGenerating: boolean;
    currentIndex: number;
    currentFileName: string;
    totalFiles: number;
    cancelRequested: boolean;
};

interface UiState {
    settingsDialog: {
        isOpen: boolean;
        defaultTab: string;
    };
    generationProgress: GenerationProgress;
    hasAttemptedGeneration: boolean;
    activeLeftTab: 'category' | 'log';
}

const initialState: UiState = {
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

/**
 * Transient UI state (was `uiSlice` in Redux) — not persisted.
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 */
export const useUiStore = create<UiState>()(immer(() => initialState));

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function setSettingsDialogOpen(open: boolean) {
    useUiStore.setState((state) => {
        state.settingsDialog.isOpen = open;
    });
}

export function setSettingsDialogTab(tab: string) {
    useUiStore.setState((state) => {
        state.settingsDialog.defaultTab = tab;
    });
}

export function setGenerationProgress(progress: Partial<GenerationProgress>) {
    useUiStore.setState((state) => {
        state.generationProgress = { ...state.generationProgress, ...progress };
    });
}

export function setHasAttemptedGeneration(attempted: boolean) {
    useUiStore.setState((state) => {
        state.hasAttemptedGeneration = attempted;
    });
}

export function setActiveLeftTab(tab: 'category' | 'log') {
    useUiStore.setState((state) => {
        state.activeLeftTab = tab;
    });
}
