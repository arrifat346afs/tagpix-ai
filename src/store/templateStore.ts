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

interface TemplateData {
    activeTemplateId: string | null;
    userTemplates: UserTemplate[];
    editedDefaultTemplates: EditedDefaultTemplate[];
}

interface TemplateStore extends TemplateData {
    setActiveTemplate: (id: string | null) => void;
    addUserTemplate: (template: Omit<UserTemplate, 'id' | 'createdAt'>) => void;
    updateUserTemplate: (payload: { id: string; template: Partial<UserTemplate> }) => void;
    deleteUserTemplate: (id: string) => void;
    editDefaultTemplate: (payload: { id: string; template: string }) => void;
    resetDefaultTemplate: (id: string) => void;
    resetAllDefaultTemplates: () => void;
}

const initialState: TemplateData = {
    activeTemplateId: null,
    userTemplates: [],
    editedDefaultTemplates: [],
};

/**
 * Persisted user/editable templates (was `templateSlice` in Redux).
 */
export const useTemplateStore = create<TemplateStore>()(
    persist(
        immer((set) => ({
            ...initialState,

            setActiveTemplate: (id) =>
                set((state) => {
                    state.activeTemplateId = id;
                }),

            addUserTemplate: (template) =>
                set((state) => {
                    const newTemplate: UserTemplate = {
                        ...template,
                        id: Date.now().toString(),
                        createdAt: new Date().toISOString(),
                    };
                    state.userTemplates.push(newTemplate);
                }),

            updateUserTemplate: (payload) =>
                set((state) => {
                    const index = state.userTemplates.findIndex((t) => t.id === payload.id);
                    if (index !== -1) {
                        state.userTemplates[index] = { ...state.userTemplates[index], ...payload.template };
                    }
                }),

            deleteUserTemplate: (id) =>
                set((state) => {
                    state.userTemplates = state.userTemplates.filter((t) => t.id !== id);
                    if (state.activeTemplateId === id) {
                        state.activeTemplateId = null;
                    }
                }),

            editDefaultTemplate: (payload) =>
                set((state) => {
                    const { id, template } = payload;
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
                }),

            resetDefaultTemplate: (id) =>
                set((state) => {
                    state.editedDefaultTemplates = state.editedDefaultTemplates.filter((t) => t.id !== id);
                }),

            resetAllDefaultTemplates: () =>
                set((state) => {
                    state.editedDefaultTemplates = [];
                }),
        })),
        {
            name: 'descify-template',
        }
    )
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const setActiveTemplate = useTemplateStore.getState().setActiveTemplate;
export const addUserTemplate = useTemplateStore.getState().addUserTemplate;
export const updateUserTemplate = useTemplateStore.getState().updateUserTemplate;
export const deleteUserTemplate = useTemplateStore.getState().deleteUserTemplate;
export const editDefaultTemplate = useTemplateStore.getState().editDefaultTemplate;
export const resetDefaultTemplate = useTemplateStore.getState().resetDefaultTemplate;
export const resetAllDefaultTemplates = useTemplateStore.getState().resetAllDefaultTemplates;
