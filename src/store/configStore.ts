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

interface ConfigState {
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

const initialState: ConfigState = {
  api: {
    selectedProvider: '',
    selectedModel: '',
    apiKeys: {
      openai: '',
      gemini: '',
      mistral: '',
      groq: '',
      openrouter: '',
    },
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
 * The store holds STATE ONLY — every action is an explicit standalone
 * function below that updates the store via setState.
 * Only the data fields are persisted — JSON.stringify drops the action
 * functions automatically, and rehydration shallow-merges onto the
 * initial state.
 */
export const useConfigStore = create<ConfigState>()(
  persist(immer(() => initialState), {
    name: 'descify-config',
  })
);

// ===================== Actions =====================
// Each action is a standalone function that explicitly updates the store,
// so components can import them directly (stable references, no hooks).

export function setSelectedProvider(provider: Provider | '') {
  useConfigStore.setState((state) => {
    state.api.selectedProvider = provider;
  });
}

export function setSelectedModel(model: string) {
  useConfigStore.setState((state) => {
    state.api.selectedModel = model;
  });
}

export function setApiKey(provider: Provider, key: string) {
  useConfigStore.setState((state) => {
    state.api.apiKeys[provider] = key;
  });
}

export function setApiKeys(keys: Record<Provider, string>) {
  useConfigStore.setState((state) => {
    state.api.apiKeys = keys;
  });
}

export function setRequestDelay(delay: number) {
  useConfigStore.setState((state) => {
    state.api.requestDelay = delay;
  });
}

export function setProcessingMode(mode: ProcessingMode) {
  useConfigStore.setState((state) => {
    state.api.processingMode = mode;
  });
}

export function setParallelWorkers(workers: number) {
  useConfigStore.setState((state) => {
    state.api.parallelWorkers = Math.max(1, Math.min(5, workers));
  });
}

export function setUseLocalModel(use: boolean) {
  useConfigStore.setState((state) => {
    state.api.useLocalModel = use;
  });
}

export function setLocalModelName(name: string) {
  useConfigStore.setState((state) => {
    state.api.localModelName = name;
  });
}

export function setLocalApiUrl(url: string) {
  useConfigStore.setState((state) => {
    state.api.localApiUrl = url;
  });
}

export function setMetadataLimits(limits: Partial<MetadataLimits>) {
  useConfigStore.setState((state) => {
    state.metadataLimits = { ...state.metadataLimits, ...limits };
  });
}

export function setMetadataOptions(options: Partial<MetadataOptions>) {
  useConfigStore.setState((state) => {
    state.metadataOptions = { ...state.metadataOptions, ...options };
  });
}

export function setEmbedSettings(settings: Partial<EmbedSettings>) {
  useConfigStore.setState((state) => {
    // Deep merge for embedSettings
    const { enabled, fields } = settings;
    if (enabled !== undefined) state.embedSettings.enabled = enabled;
    if (fields) {
      state.embedSettings.fields = { ...state.embedSettings.fields, ...fields };
    }
  });
}

export function setExportSettings(settings: Partial<ExportSettings>) {
  useConfigStore.setState((state) => {
    state.exportSettings = { ...state.exportSettings, ...settings };
  });
}

// ===================== Non-reactive helpers =====================

/** True when at least one provider has a non-empty API key. */
export function hasApiKey(): boolean {
  return Object.values(useConfigStore.getState().api.apiKeys).some(
    (key) => key && key.trim() !== ''
  );
}

/**
 * Ensure export settings are fully initialized after (synchronous) localStorage
 * rehydration: only fill in missing values, never override values the user has
 * explicitly turned off. This used to be a side effect in the removed
 * SettingsContext provider.
 */
function initializeExportSettings() {
  const es = useConfigStore.getState().exportSettings;
  if (!es || es.adobeStock === undefined || es.shutterStock === undefined) {
    setExportSettings({
      adobeStock: es?.adobeStock ?? true,
      shutterStock: es?.shutterStock ?? true,
    });
  }
}

initializeExportSettings();
