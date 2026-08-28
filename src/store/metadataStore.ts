import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type CategorySelection = {
    adobeStock: string;
    shutterStock1: string;
    shutterStock2: string;
};

export type GeneratedMetadata = {
    title: string;
    description: string;
    keywords: string;
};

export type FileMetadata = {
    file: File;
    metadata: GeneratedMetadata;
    categories?: CategorySelection;
    customInstruction?: string;
};

interface MetadataData {
    generatedMetadata: FileMetadata[];
    defaultCategories: CategorySelection;
}

interface MetadataStore extends MetadataData {
    setGeneratedMetadata: (metadata: FileMetadata[]) => void;
    updateFileMetadata: (payload: { file: File; metadata: Partial<GeneratedMetadata> }) => void;
    updateFileCategories: (payload: { file: File; categories: Partial<CategorySelection> }) => void;
    updateCustomInstruction: (payload: { file: File; instruction: string }) => void;
    setDefaultCategories: (categories: Partial<CategorySelection>) => void;
    clearGeneratedMetadata: () => void;
}

const initialState: MetadataData = {
    generatedMetadata: [],
    defaultCategories: {
        adobeStock: '',
        shutterStock1: '',
        shutterStock2: '',
    },
};

/** AI-generated metadata per file (was `metadataSlice` in Redux) — not persisted. */
export const useMetadataStore = create<MetadataStore>()(
    immer((set) => ({
        ...initialState,

        setGeneratedMetadata: (metadata) =>
            set((state) => {
                state.generatedMetadata = metadata;
            }),

        updateFileMetadata: (payload) =>
            set((state) => {
                const index = state.generatedMetadata.findIndex((m) => m.file === payload.file);
                if (index !== -1) {
                    state.generatedMetadata[index].metadata = {
                        ...state.generatedMetadata[index].metadata,
                        ...payload.metadata,
                    };
                } else {
                    // File not found, add it
                    state.generatedMetadata.push({
                        file: payload.file,
                        metadata: {
                            title: payload.metadata.title || '',
                            description: payload.metadata.description || '',
                            keywords: payload.metadata.keywords || '',
                        },
                        categories: { ...state.defaultCategories },
                    });
                }
            }),

        updateFileCategories: (payload) =>
            set((state) => {
                const index = state.generatedMetadata.findIndex((m) => m.file === payload.file);
                if (index !== -1) {
                    state.generatedMetadata[index].categories = {
                        ...(state.generatedMetadata[index].categories || state.defaultCategories),
                        ...payload.categories,
                    };
                } else {
                    state.generatedMetadata.push({
                        file: payload.file,
                        metadata: { title: '', description: '', keywords: '' },
                        categories: { ...state.defaultCategories, ...payload.categories },
                    });
                }
            }),

        updateCustomInstruction: (payload) =>
            set((state) => {
                const index = state.generatedMetadata.findIndex((m) => m.file === payload.file);
                if (index !== -1) {
                    state.generatedMetadata[index].customInstruction = payload.instruction;
                } else {
                    state.generatedMetadata.push({
                        file: payload.file,
                        metadata: { title: '', description: '', keywords: '' },
                        customInstruction: payload.instruction,
                    });
                }
            }),

        setDefaultCategories: (categories) =>
            set((state) => {
                state.defaultCategories = { ...state.defaultCategories, ...categories };
            }),

        clearGeneratedMetadata: () =>
            set((state) => {
                state.generatedMetadata = [];
            }),
    }))
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const setGeneratedMetadata = useMetadataStore.getState().setGeneratedMetadata;
export const updateFileMetadata = useMetadataStore.getState().updateFileMetadata;
export const updateFileCategories = useMetadataStore.getState().updateFileCategories;
export const updateCustomInstruction = useMetadataStore.getState().updateCustomInstruction;
export const setDefaultCategories = useMetadataStore.getState().setDefaultCategories;
export const clearGeneratedMetadata = useMetadataStore.getState().clearGeneratedMetadata;
