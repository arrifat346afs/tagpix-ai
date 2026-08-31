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

interface MetadataState {
    generatedMetadata: FileMetadata[];
    defaultCategories: CategorySelection;
}

const initialState: MetadataState = {
    generatedMetadata: [],
    defaultCategories: {
        adobeStock: '',
        shutterStock1: '',
        shutterStock2: '',
    },
};

/**
 * AI-generated metadata per file (was `metadataSlice` in Redux) — not persisted.
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 */
export const useMetadataStore = create<MetadataState>()(immer(() => initialState));

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function setGeneratedMetadata(metadata: FileMetadata[]) {
    useMetadataStore.setState((state) => {
        state.generatedMetadata = metadata;
    });
}

export function updateFileMetadata(file: File, metadata: Partial<GeneratedMetadata>) {
    useMetadataStore.setState((state) => {
        const index = state.generatedMetadata.findIndex((m) => m.file === file);
        if (index !== -1) {
            state.generatedMetadata[index].metadata = {
                ...state.generatedMetadata[index].metadata,
                ...metadata,
            };
        } else {
            // File not found, add it
            state.generatedMetadata.push({
                file,
                metadata: {
                    title: metadata.title || '',
                    description: metadata.description || '',
                    keywords: metadata.keywords || '',
                },
                categories: { ...state.defaultCategories },
            });
        }
    });
}

export function updateFileCategories(file: File, categories: Partial<CategorySelection>) {
    useMetadataStore.setState((state) => {
        const index = state.generatedMetadata.findIndex((m) => m.file === file);
        if (index !== -1) {
            state.generatedMetadata[index].categories = {
                ...(state.generatedMetadata[index].categories || state.defaultCategories),
                ...categories,
            };
        } else {
            state.generatedMetadata.push({
                file,
                metadata: { title: '', description: '', keywords: '' },
                categories: { ...state.defaultCategories, ...categories },
            });
        }
    });
}

export function updateCustomInstruction(file: File, instruction: string) {
    useMetadataStore.setState((state) => {
        const index = state.generatedMetadata.findIndex((m) => m.file === file);
        if (index !== -1) {
            state.generatedMetadata[index].customInstruction = instruction;
        } else {
            state.generatedMetadata.push({
                file,
                metadata: { title: '', description: '', keywords: '' },
                customInstruction: instruction,
            });
        }
    });
}

export function setDefaultCategories(categories: Partial<CategorySelection>) {
    useMetadataStore.setState((state) => {
        state.defaultCategories = { ...state.defaultCategories, ...categories };
    });
}

export function clearGeneratedMetadata() {
    useMetadataStore.setState((state) => {
        state.generatedMetadata = [];
    });
}

// ===================== Non-reactive helpers =====================

/** Get the generated metadata for a file without subscribing to the store. */
export function getMetadata(file: File): GeneratedMetadata | undefined {
    return useMetadataStore.getState().generatedMetadata.find((m) => m.file === file)?.metadata;
}

/** Get the category selection for a file without subscribing to the store. */
export function getCategories(file: File): CategorySelection | undefined {
    return useMetadataStore.getState().generatedMetadata.find((m) => m.file === file)?.categories;
}

/** Get the custom instruction for a file without subscribing to the store. */
export function getCustomInstruction(file: File): string | undefined {
    return useMetadataStore.getState().generatedMetadata.find((m) => m.file === file)?.customInstruction;
}
