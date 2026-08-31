import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type UserTemplate = {
    id: string;
    name: string;
    template: string;
    createdAt: string; // ISO String for serializability
};

export type EditedDefaultTemplate = {
    id: string;
    template: string;
    editedAt: string; // ISO String for serializability
};

interface TemplateState {
    activeTemplateId: string | null;
    userTemplates: UserTemplate[];
    editedDefaultTemplates: EditedDefaultTemplate[];
}

const initialState: TemplateState = {
    activeTemplateId: null,
    userTemplates: [],
    editedDefaultTemplates: [],
};

/**
 * Persisted user/editable templates (was `templateSlice` in Redux).
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 */
export const useTemplateStore = create<TemplateState>()(
    persist(immer(() => initialState), {
        name: 'descify-template',
    })
);

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function setActiveTemplate(id: string | null) {
    useTemplateStore.setState((state) => {
        state.activeTemplateId = id;
    });
}

export function addUserTemplate(template: Omit<UserTemplate, 'id' | 'createdAt'>) {
    useTemplateStore.setState((state) => {
        const newTemplate: UserTemplate = {
            ...template,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
        };
        state.userTemplates.push(newTemplate);
    });
}

export function updateUserTemplate(id: string, template: Partial<UserTemplate>) {
    useTemplateStore.setState((state) => {
        const index = state.userTemplates.findIndex((t) => t.id === id);
        if (index !== -1) {
            state.userTemplates[index] = { ...state.userTemplates[index], ...template };
        }
    });
}

export function deleteUserTemplate(id: string) {
    useTemplateStore.setState((state) => {
        state.userTemplates = state.userTemplates.filter((t) => t.id !== id);
        if (state.activeTemplateId === id) {
            state.activeTemplateId = null;
        }
    });
}

export function editDefaultTemplate(id: string, template: string) {
    useTemplateStore.setState((state) => {
        const existingIndex = state.editedDefaultTemplates.findIndex((t) => t.id === id);
        const editedTemplate: EditedDefaultTemplate = {
            id,
            template,
            editedAt: new Date().toISOString(),
        };
        if (existingIndex !== -1) {
            state.editedDefaultTemplates[existingIndex] = editedTemplate;
        } else {
            state.editedDefaultTemplates.push(editedTemplate);
        }
    });
}

export function resetDefaultTemplate(id: string) {
    useTemplateStore.setState((state) => {
        state.editedDefaultTemplates = state.editedDefaultTemplates.filter((t) => t.id !== id);
    });
}

export function resetAllDefaultTemplates() {
    useTemplateStore.setState((state) => {
        state.editedDefaultTemplates = [];
    });
}

// ===================== Non-reactive helpers =====================

/** True when a default template has been customized by the user. */
export function isDefaultTemplateEdited(id: string): boolean {
    return useTemplateStore.getState().editedDefaultTemplates.some((t) => t.id === id);
}
