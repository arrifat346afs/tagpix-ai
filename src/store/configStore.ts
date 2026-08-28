import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type Provider = 'openai' | 'gemini' | 'mistral' | 'groq' | 'openrouter';

export type MetadataLimits = {
  titleLimit: number;
  descriptionLimit: number;
  keywordLimit: number;
};

export type MetadataOptions = {
  includePlaceName: boolean;
  autoSelectGenerated: boolean;
  autoScrollOnKeyboardNavigation: boolean;
  titleAvoidWords: string[];
  keywordsAvoidWords: string[];
  descriptionAvoidWords: string[];
};

export type EmbedSettings = {
  enabled: boolean;
  fields: {
    title: boolean;
    description: boolean;
    keywords: boolean;
  };
};

export type ExportSettings = {
  adobeStock: boolean;
  shutterStock: boolean;
};

export type ProcessingMode = 'sequential' | 'parallel';

interface ConfigData {
  api: {
    selectedProvider: Provider | '';
    selectedModel: string;
    apiKeys: Record<Provider, string>;
    requestDelay: number;
    processingMode: ProcessingMode;
    parallelWorkers: number;
    useLocalModel: boolean;
    localModelName: string;
    localApiUrl: string;
  };
  metadataLimits: MetadataLimits;
  metadataOptions: MetadataOptions;
  embedSettings: EmbedSettings;
  exportSettings: ExportSettings;
}

interface ConfigStore extends ConfigData {
  setSelectedProvider: (provider: Provider | '') => void;
  setSelectedModel: (model: string) => void;
  setApiKey: (payload: { provider: Provider; key: string }) => void;
  setApiKeys: (keys: Record<Provider, string>) => void;
  setRequestDelay: (delay: number) => void;
  setProcessingMode: (mode: ProcessingMode) => void;
  setParallelWorkers: (workers: number) => void;
  setUseLocalModel: (use: boolean) => void;
  setLocalModelName: (name: string) => void;
  setLocalApiUrl: (url: string) => void;
  setMetadataLimits: (limits: Partial<MetadataLimits>) => void;
  setMetadataOptions: (options: Partial<MetadataOptions>) => void;
  setEmbedSettings: (settings: Partial<EmbedSettings>) => void;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
}

const defaultApiKeys: Record<Provider, string> = {
  openai: '',
  gemini: '',
  mistral: '',
  groq: '',
  openrouter: '',
};

const initialState: ConfigData = {
  api: {
    selectedProvider: '',
    selectedModel: '',
    apiKeys: defaultApiKeys,
    requestDelay: 0,
    processingMode: 'sequential',
    parallelWorkers: 5,
    useLocalModel: false,
    localModelName: '',
    localApiUrl: '',
  },
  metadataLimits: {
    titleLimit: 200,
    descriptionLimit: 200,
    keywordLimit: 80,
  },
  metadataOptions: {
    includePlaceName: false,
    autoSelectGenerated: true,
    autoScrollOnKeyboardNavigation: true,
    titleAvoidWords: [],
    keywordsAvoidWords: [],
    descriptionAvoidWords: [],
  },
  embedSettings: {
    enabled: true,
    fields: {
      title: true,
      description: true,
      keywords: true,
    },
  },
  exportSettings: {
    adobeStock: true,
    shutterStock: true,
  },
};

/**
 * Persisted application/config settings (was `configSlice` in Redux).
 * Only the data fields are persisted — JSON.stringify drops the action
 * functions automatically, and rehydration shallow-merges onto the
 * initial state so the actions survive.
 */
export const useConfigStore = create<ConfigStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      setSelectedProvider: (provider) =>
        set((state) => {
          state.api.selectedProvider = provider;
        }),

      setSelectedModel: (model) =>
        set((state) => {
          state.api.selectedModel = model;
        }),

      setApiKey: (payload) =>
        set((state) => {
          state.api.apiKeys[payload.provider] = payload.key;
        }),

      setApiKeys: (keys) =>
        set((state) => {
          state.api.apiKeys = keys;
        }),

      setRequestDelay: (delay) =>
        set((state) => {
          state.api.requestDelay = delay;
        }),

      setProcessingMode: (mode) =>
        set((state) => {
          state.api.processingMode = mode;
        }),

      setParallelWorkers: (workers) =>
        set((state) => {
          state.api.parallelWorkers = Math.max(1, Math.min(5, workers));
        }),

      setUseLocalModel: (use) =>
        set((state) => {
          state.api.useLocalModel = use;
        }),

      setLocalModelName: (name) =>
        set((state) => {
          state.api.localModelName = name;
        }),

      setLocalApiUrl: (url) =>
        set((state) => {
          state.api.localApiUrl = url;
        }),

      setMetadataLimits: (limits) =>
        set((state) => {
          state.metadataLimits = { ...state.metadataLimits, ...limits };
        }),

      setMetadataOptions: (options) =>
        set((state) => {
          state.metadataOptions = { ...state.metadataOptions, ...options };
        }),

      setEmbedSettings: (settings) =>
        set((state) => {
          // Deep merge for embedSettings
          const { enabled, fields } = settings;
          if (enabled !== undefined) state.embedSettings.enabled = enabled;
          if (fields) {
            state.embedSettings.fields = { ...state.embedSettings.fields, ...fields };
          }
        }),

      setExportSettings: (settings) =>
        set((state) => {
          state.exportSettings = { ...state.exportSettings, ...settings };
        }),
    })),
    {
      name: 'descify-config',
    }
  )
);

// Standalone action exports (stable references). Zustand actions execute
// immediately when called, which keeps the existing `dispatch(action(payload))`
// call style in the migration-adapter code working unchanged.
export const setSelectedProvider = useConfigStore.getState().setSelectedProvider;
export const setSelectedModel = useConfigStore.getState().setSelectedModel;
export const setApiKey = useConfigStore.getState().setApiKey;
export const setApiKeys = useConfigStore.getState().setApiKeys;
export const setRequestDelay = useConfigStore.getState().setRequestDelay;
export const setProcessingMode = useConfigStore.getState().setProcessingMode;
export const setParallelWorkers = useConfigStore.getState().setParallelWorkers;
export const setUseLocalModel = useConfigStore.getState().setUseLocalModel;
export const setLocalModelName = useConfigStore.getState().setLocalModelName;
export const setLocalApiUrl = useConfigStore.getState().setLocalApiUrl;
export const setMetadataLimits = useConfigStore.getState().setMetadataLimits;
export const setMetadataOptions = useConfigStore.getState().setMetadataOptions;
export const setEmbedSettings = useConfigStore.getState().setEmbedSettings;
export const setExportSettings = useConfigStore.getState().setExportSettings;
