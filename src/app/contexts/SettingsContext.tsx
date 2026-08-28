import { createContext, useContext, ReactNode, useCallback, useMemo, useEffect, useRef } from 'react';
import { useConfigStore } from '../../store/configStore';
import { useFileStore } from '../../store/fileStore';
import { useMetadataStore } from '../../store/metadataStore';
import { useTemplateStore } from '../../store/templateStore';
import { useUiStore } from '../../store/uiStore';
import { useBatchStore } from '../../store/batchStore';
import * as configSlice from '../../store/configStore';
import * as fileSlice from '../../store/fileStore';
import * as metadataSlice from '../../store/metadataStore';
import * as templateSlice from '../../store/templateStore';
import * as uiSlice from '../../store/uiStore';
import * as batchSlice from '../../store/batchStore';
import { BATCH_CONFIG } from '@/app/lib/thumbnailGenerator';

/**
 * Zustand migration adapter: Zustand actions execute immediately when called,
 * so there is no dispatch step. This no-op keeps the existing
 * `dispatch(action(payload))` call style in this file working unchanged — the
 * inner action call performs the state update and `dispatch` discards the
 * (void) result. Gradually replace `dispatch(xSlice.action(...))` with a
 * direct `xSlice.action(...)` call and remove this adapter.
 */
const dispatch = (_action: void): void => {};


// Re-export types from slices to maintain compatibility
export type Provider = configSlice.Provider;
export type MetadataLimits = configSlice.MetadataLimits;
export type MetadataOptions = configSlice.MetadataOptions;
export type EmbedSettings = configSlice.EmbedSettings;
export type ExportSettings = configSlice.ExportSettings;
export type ThumbnailData = fileSlice.ThumbnailData;
export type GeneratedMetadata = metadataSlice.GeneratedMetadata;
export type FileMetadata = metadataSlice.FileMetadata;
export type CategorySelection = metadataSlice.CategorySelection;
export type GenerationProgress = uiSlice.GenerationProgress;
export type UserTemplate = templateSlice.UserTemplate;
import type { FolderInfo } from '@/app/_component/batch/FolderInfoCard';
export type { FolderInfo };

// Define composite types that were previously in SettingsContext
export type ApiSettingsState = {
  selectedProvider: Provider | '';
  setSelectedProvider: (p: Provider | '') => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  apiKeys: Record<Provider, string>;
  setApiKey: (provider: Provider, key: string) => void;
  requestDelay: number;
  setRequestDelay: (delay: number) => void;
  processingMode: configSlice.ProcessingMode;
  setProcessingMode: (mode: configSlice.ProcessingMode) => void;
  parallelWorkers: number;
  setParallelWorkers: (workers: number) => void;
  useLocalModel: boolean;
  setUseLocalModel: (use: boolean) => void;
  localModelName: string;
  setLocalModelName: (name: string) => void;
  localApiUrl: string;
  setLocalApiUrl: (url: string) => void;
};

export type TemplateSettings = {
  activeTemplateId: string | null;
  userTemplates: UserTemplate[];
  editedDefaultTemplates: templateSlice.EditedDefaultTemplate[];
  setActiveTemplate: (id: string | null) => void;
  addUserTemplate: (template: Omit<UserTemplate, 'id' | 'createdAt'>) => void;
  updateUserTemplate: (id: string, template: Partial<UserTemplate>) => void;
  deleteUserTemplate: (id: string) => void;
  editDefaultTemplate: (id: string, template: string) => void;
  resetDefaultTemplate: (id: string) => void;
  resetAllDefaultTemplates: () => void;
  isDefaultTemplateEdited: (id: string) => boolean;
};

export type SettingsDialogState = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  defaultTab: string;
  setDefaultTab: (tab: string) => void;
};

export type SettingsContextType = {
  api: ApiSettingsState;
  metadataLimits: MetadataLimits & { setLimits: (l: Partial<MetadataLimits>) => void };
  metadataOptions: MetadataOptions & { setOptions: (o: Partial<MetadataOptions>) => void };
  embedSettings: EmbedSettings & { setEmbedSettings: (s: Partial<EmbedSettings>) => void };
  exportSettings: ExportSettings & { setExportSettings: (s: Partial<ExportSettings>) => void };
  templateSettings: TemplateSettings;
  files: File[];
  setFiles: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeFile: (file: File) => void;
  filePaths: Map<File, string>;
  setFilePath: (file: File, path: string) => void;
  getFilePath: (file: File) => string | undefined;
  thumbnails: {
    items: ThumbnailData[];
    setItems: (items: ThumbnailData[]) => void;
    upsert: (t: ThumbnailData) => void;
    clear: () => void;
    isGenerating: boolean;
    setIsGenerating: (generating: boolean) => void;
    pendingCount: number;
  };
  generated: {
    items: FileMetadata[];
    getMetadata: (file: File) => GeneratedMetadata | undefined;
    setMetadata: (file: File, metadata: Partial<GeneratedMetadata>) => void;
    getCategories: (file: File) => CategorySelection | undefined;
    setFileCategories: (file: File, categories: Partial<CategorySelection>) => void;
    getCustomInstruction: (file: File) => string | undefined;
    setCustomInstruction: (file: File, instruction: string) => void;
    clear: () => void;
  };
  generationProgress: GenerationProgress;
  setGenerationProgress: (progress: Partial<GenerationProgress>) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  hasAttemptedGeneration: boolean;
  setHasAttemptedGeneration: (attempted: boolean) => void;
  categories: CategorySelection;
  setCategories: (categories: Partial<CategorySelection>) => void;
  settingsDialog: SettingsDialogState;
  batchFolders: FolderInfo[];
  setBatchFolders: (folders: FolderInfo[]) => void;
  addBatchFolder: (folder: FolderInfo) => void;
  updateBatchFolder: (id: string, updates: Partial<FolderInfo>) => void;
  removeBatchFolder: (id: string) => void;
  clearBatchFolders: () => void;
  hasApiKey: () => boolean;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // Selectors
  const config = useConfigStore();
  const fileState = useFileStore();
  const metadataState = useMetadataStore();
  const templateState = useTemplateStore();
  const uiState = useUiStore();
  const batchState = useBatchStore();


  // --- API ---
  const setSelectedProvider = useCallback((provider: Provider | '') => {
    dispatch(configSlice.setSelectedProvider(provider));
  }, [dispatch]);

  const setSelectedModel = useCallback((model: string) => {
    dispatch(configSlice.setSelectedModel(model));
  }, [dispatch]);

  const setApiKey = useCallback((provider: Provider, key: string) => {
    dispatch(configSlice.setApiKey({ provider, key }));
  }, [dispatch]);

  const setRequestDelay = useCallback((delay: number) => {
    dispatch(configSlice.setRequestDelay(delay));
  }, [dispatch]);

  const setProcessingMode = useCallback((mode: configSlice.ProcessingMode) => {
    dispatch(configSlice.setProcessingMode(mode));
  }, [dispatch]);

  const setParallelWorkers = useCallback((workers: number) => {
    dispatch(configSlice.setParallelWorkers(workers));
  }, [dispatch]);

  const setUseLocalModel = useCallback((use: boolean) => {
    dispatch(configSlice.setUseLocalModel(use));
  }, [dispatch]);

  const setLocalModelName = useCallback((name: string) => {
    dispatch(configSlice.setLocalModelName(name));
  }, [dispatch]);

  const setLocalApiUrl = useCallback((url: string) => {
    dispatch(configSlice.setLocalApiUrl(url));
  }, [dispatch]);

  const apiValue: ApiSettingsState = useMemo(() => ({
    selectedProvider: config.api.selectedProvider,
    setSelectedProvider,
    selectedModel: config.api.selectedModel,
    setSelectedModel,
    apiKeys: config.api.apiKeys,
    setApiKey,
    requestDelay: config.api.requestDelay,
    setRequestDelay,
    processingMode: config.api.processingMode,
    setProcessingMode,
    parallelWorkers: config.api.parallelWorkers,
    setParallelWorkers,
    useLocalModel: config.api.useLocalModel,
    setUseLocalModel,
    localModelName: config.api.localModelName,
    setLocalModelName,
    localApiUrl: config.api.localApiUrl,
    setLocalApiUrl,
  }), [config.api, setSelectedProvider, setSelectedModel, setApiKey, setRequestDelay, setProcessingMode, setParallelWorkers, setUseLocalModel, setLocalModelName, setLocalApiUrl]);

  // --- Metadata Limits ---
  const setLimits = useCallback((l: Partial<MetadataLimits>) => {
    dispatch(configSlice.setMetadataLimits(l));
  }, [dispatch]);

  // --- Metadata Options ---
  const setOptions = useCallback((o: Partial<MetadataOptions>) => {
    dispatch(configSlice.setMetadataOptions(o));
  }, [dispatch]);

  // --- Embed Settings ---
  const setEmbedSettings = useCallback((s: Partial<EmbedSettings>) => {
    dispatch(configSlice.setEmbedSettings(s));
  }, [dispatch]);

  // --- Export Settings ---
  const setExportSettings = useCallback((s: Partial<ExportSettings>) => {
    dispatch(configSlice.setExportSettings(s));
  }, [dispatch]);

  // --- Templates ---
  const setActiveTemplate = useCallback((id: string | null) => {
    dispatch(templateSlice.setActiveTemplate(id));
  }, [dispatch]);

  const addUserTemplate = useCallback((template: Omit<UserTemplate, 'id' | 'createdAt'>) => {
    dispatch(templateSlice.addUserTemplate(template));
  }, [dispatch]);

  const updateUserTemplate = useCallback((id: string, template: Partial<UserTemplate>) => {
    dispatch(templateSlice.updateUserTemplate({ id, template }));
  }, [dispatch]);

  const deleteUserTemplate = useCallback((id: string) => {
    dispatch(templateSlice.deleteUserTemplate(id));
  }, [dispatch]);

  const editDefaultTemplate = useCallback((id: string, template: string) => {
    dispatch(templateSlice.editDefaultTemplate({ id, template }));
  }, [dispatch]);

  const resetDefaultTemplate = useCallback((id: string) => {
    dispatch(templateSlice.resetDefaultTemplate(id));
  }, [dispatch]);

  const resetAllDefaultTemplates = useCallback(() => {
    dispatch(templateSlice.resetAllDefaultTemplates());
  }, [dispatch]);

  const isDefaultTemplateEdited = useCallback((id: string) => {
    return templateState.editedDefaultTemplates?.some(t => t.id === id) ?? false;
  }, [templateState.editedDefaultTemplates]);

  const setBatchFolders = useCallback((folders: FolderInfo[]) => {
    dispatch(batchSlice.setFolders(folders));
  }, [dispatch]);

  const addBatchFolder = useCallback((folder: FolderInfo) => {
    dispatch(batchSlice.addFolder(folder));
  }, [dispatch]);

  const updateBatchFolder = useCallback((id: string, updates: Partial<FolderInfo>) => {
    dispatch(batchSlice.updateFolder({ id, updates }));
  }, [dispatch]);

  const removeBatchFolder = useCallback((id: string) => {
    dispatch(batchSlice.removeFolder(id));
  }, [dispatch]);

  const clearBatchFolders = useCallback(() => {
    dispatch(batchSlice.clearFolders());
  }, [dispatch]);

  const templateSettingsValue: TemplateSettings = useMemo(() => ({
    activeTemplateId: templateState.activeTemplateId,
    userTemplates: templateState.userTemplates,
    editedDefaultTemplates: templateState.editedDefaultTemplates,
    setActiveTemplate,
    addUserTemplate,
    updateUserTemplate,
    deleteUserTemplate,
    editDefaultTemplate,
    resetDefaultTemplate,
    resetAllDefaultTemplates,
    isDefaultTemplateEdited,
  }), [templateState, setActiveTemplate, addUserTemplate, updateUserTemplate, deleteUserTemplate, editDefaultTemplate, resetDefaultTemplate, resetAllDefaultTemplates, isDefaultTemplateEdited]);

  // --- Files ---
  const setFiles = useCallback((files: File[]) => {
    dispatch(fileSlice.setFiles(files));
  }, [dispatch]);

  const addFilesToState = useCallback((files: File[]) => {
    dispatch(fileSlice.addFiles(files));
  }, [dispatch]);

  const removeFile = useCallback((file: File) => {
    dispatch(fileSlice.removeFile(file));
  }, [dispatch]);

  const setFilePath = useCallback((file: File, path: string) => {
    dispatch(fileSlice.setFilePath({ file, path }));
  }, [dispatch]);

  const getFilePath = useCallback((file: File) => {
    return fileState.filePaths.get(file);
  }, [fileState.filePaths]);

  // --- Thumbnails ---
  const setThumbnailsItems = useCallback((items: ThumbnailData[]) => {
    dispatch(fileSlice.setThumbnails(items));
  }, [dispatch]);

  const upsertThumbnail = useCallback((t: ThumbnailData) => {
    dispatch(fileSlice.addThumbnail(t));
  }, [dispatch]);

  const clearThumbnails = useCallback(() => {
    dispatch(fileSlice.clearThumbnails());
  }, [dispatch]);

  const setIsGeneratingThumbnails = useCallback((generating: boolean) => {
    dispatch(fileSlice.setIsGeneratingThumbnails(generating));
  }, [dispatch]);

  // --- Generated Metadata ---
  // Use ref to access current metadata state without causing re-renders
  const metadataStateRef = useRef(metadataState);
  metadataStateRef.current = metadataState;

  const getMetadata = useCallback((file: File) => {
    return metadataStateRef.current.generatedMetadata.find(m => m.file === file)?.metadata;
  }, []);

  const setMetadata = useCallback((file: File, metadata: Partial<GeneratedMetadata>) => {
    dispatch(metadataSlice.updateFileMetadata({ file, metadata }));
  }, [dispatch]);

  const getCategories = useCallback((file: File) => {
    return metadataStateRef.current.generatedMetadata.find(m => m.file === file)?.categories;
  }, []);

  const setFileCategories = useCallback((file: File, categories: Partial<CategorySelection>) => {
    dispatch(metadataSlice.updateFileCategories({ file, categories }));
  }, [dispatch]);

  const getCustomInstruction = useCallback((file: File) => {
    return metadataStateRef.current.generatedMetadata.find(m => m.file === file)?.customInstruction;
  }, []);

  const setCustomInstruction = useCallback((file: File, instruction: string) => {
    dispatch(metadataSlice.updateCustomInstruction({ file, instruction }));
  }, [dispatch]);

  const clearGenerated = useCallback(() => {
    dispatch(metadataSlice.clearGeneratedMetadata());
  }, [dispatch]);

  // --- UI ---
  const setGenerationProgress = useCallback((progress: Partial<GenerationProgress>) => {
    dispatch(uiSlice.setGenerationProgress(progress));
  }, [dispatch]);

  const setSelectedFile = useCallback((file: File | null) => {
    dispatch(fileSlice.setSelectedFile(file));
  }, [dispatch]);

  const setHasAttemptedGeneration = useCallback((attempted: boolean) => {
    dispatch(uiSlice.setHasAttemptedGeneration(attempted));
  }, [dispatch]);

  const setCategories = useCallback((categories: Partial<CategorySelection>) => {
    dispatch(metadataSlice.setDefaultCategories(categories));
  }, [dispatch]);

  const setSettingsDialogOpen = useCallback((open: boolean) => {
    dispatch(uiSlice.setSettingsDialogOpen(open));
  }, [dispatch]);

  const setSettingsDialogDefaultTab = useCallback((tab: string) => {
    dispatch(uiSlice.setSettingsDialogTab(tab));
  }, [dispatch]);


  const hasApiKey = useCallback(() => {
    return Object.values(config.api.apiKeys).some(key => key && key.trim() !== '');
  }, [config.api.apiKeys]);

  const value: SettingsContextType = useMemo(() => ({
    api: apiValue,
    metadataLimits: { ...config.metadataLimits, setLimits },
    metadataOptions: { ...config.metadataOptions, setOptions },
    embedSettings: { ...config.embedSettings, setEmbedSettings },
    exportSettings: { ...config.exportSettings, setExportSettings },
    templateSettings: templateSettingsValue,
    files: fileState.files,
    setFiles,
    addFiles: addFilesToState,
    removeFile,
    filePaths: fileState.filePaths,
    setFilePath,
    getFilePath,
    thumbnails: {
      items: fileState.thumbnails,
      setItems: setThumbnailsItems,
      upsert: upsertThumbnail,
      clear: clearThumbnails,
      isGenerating: fileState.isGeneratingThumbnails,
      setIsGenerating: setIsGeneratingThumbnails,
      pendingCount: fileState.pendingThumbnailCount,
    },
    generated: {
      items: metadataState.generatedMetadata,
      getMetadata,
      setMetadata,
      getCategories,
      setFileCategories,
      getCustomInstruction,
      setCustomInstruction,
      clear: clearGenerated,
    },
    generationProgress: uiState.generationProgress,
    setGenerationProgress,
    selectedFile: fileState.selectedFile,
    setSelectedFile,
    hasAttemptedGeneration: uiState.hasAttemptedGeneration,
    setHasAttemptedGeneration,
    categories: metadataState.defaultCategories,
    setCategories,
    settingsDialog: {
      isOpen: uiState.settingsDialog.isOpen,
      setIsOpen: setSettingsDialogOpen,
      defaultTab: uiState.settingsDialog.defaultTab,
      setDefaultTab: setSettingsDialogDefaultTab,
    },
    batchFolders: batchState.folders,
    setBatchFolders,
    addBatchFolder,
    updateBatchFolder,
    removeBatchFolder,
    clearBatchFolders,
    hasApiKey,
  }), [
    apiValue,
    config.metadataLimits, setLimits,
    config.metadataOptions, setOptions,
    config.embedSettings, setEmbedSettings,
    config.exportSettings, setExportSettings,
    templateSettingsValue,
    fileState.files, setFiles, addFilesToState, removeFile,
    fileState.filePaths, setFilePath, getFilePath,
    fileState.thumbnails, setThumbnailsItems, upsertThumbnail, clearThumbnails, fileState.isGeneratingThumbnails, setIsGeneratingThumbnails, fileState.pendingThumbnailCount,
    metadataState.generatedMetadata, getMetadata, setMetadata, getCategories, setFileCategories, getCustomInstruction, setCustomInstruction, clearGenerated,
    uiState.generationProgress, setGenerationProgress,
    fileState.selectedFile, setSelectedFile,
    uiState.hasAttemptedGeneration, setHasAttemptedGeneration,
    metadataState.defaultCategories, setCategories,
    uiState.settingsDialog.isOpen, setSettingsDialogOpen,
    uiState.settingsDialog.defaultTab, setSettingsDialogDefaultTab,
    batchState.folders, setBatchFolders, addBatchFolder, updateBatchFolder, removeBatchFolder, clearBatchFolders,
    hasApiKey
  ]);

  // --- Side Effect: Thumbnail Generation ---
  // Use refs to avoid dependency loops that cause infinite re-renders

  // Tracks how many concurrent thumbnail batches are still in flight.
  // isGenerating stays true until this reaches 0.
  const activeGenerationsRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Track files being processed to avoid duplicates
  const processingFilesRef = useRef<Set<File>>(new Set());

  useEffect(() => {
    const files = fileState.files;
    // Read thumbnails from store directly to avoid stale closure
    const thumbnails = fileState.thumbnails;

    if (!files || files.length === 0) {
      if (isGeneratingRef.current) {
        isGeneratingRef.current = false;
        dispatchRef.current(fileSlice.setIsGeneratingThumbnails(false));
      }
      return;
    }

    // Filter files that don't have thumbnails AND are not currently being processed
    const existingThumbnailFiles = new Set(thumbnails.map(t => t.file));

    const filesToGenerate = files.filter((file) => {
      const isMedia = file.type.startsWith("image/") || file.type.startsWith("video/");
      return isMedia && !existingThumbnailFiles.has(file) && !processingFilesRef.current.has(file);
    });

    if (filesToGenerate.length === 0) {
      return;
    }

    // Mark files as being processed IMMEDIATELY
    filesToGenerate.forEach(f => processingFilesRef.current.add(f));

    // Increment active-batch counter. isGenerating stays true until it returns to 0.
    activeGenerationsRef.current += 1;
    const batchId = activeGenerationsRef.current;

    if (!isGeneratingRef.current) {
      isGeneratingRef.current = true;
      dispatchRef.current(fileSlice.setIsGeneratingThumbnails(true));
    }

    console.log(`🚀 Starting generation of ${filesToGenerate.length} thumbnails (batch #${batchId})...`);

    // Don't await - run in background to keep UI responsive
    (async () => {
      try {
        const { generateThumbnailsBatch } = await import("@/app/lib/thumbnailGenerator");

        generateThumbnailsBatch(
          filesToGenerate,
          () => { }, // Progress callback
          (file, thumbnailUrl) => {
            // Dispatch directly - thumbnails appear as they finish (no batching)
            dispatchRef.current(fileSlice.upsertThumbnails([{ 
              file, 
              thumbnailUrl,
              previewUrl: null 
            }]));
            processingFilesRef.current.delete(file);
          },
          BATCH_CONFIG.CONCURRENCY,
          fileState.filePaths
        );

        console.log(`✅ Completed batch #${batchId}`);

      } catch (error) {
        console.error("❌ Batch thumbnail generation failed:", error);
        filesToGenerate.forEach(f => processingFilesRef.current.delete(f));
      } finally {
        // Decrement counter; only clear the loading flag when ALL batches are done
        activeGenerationsRef.current -= 1;
        if (activeGenerationsRef.current === 0) {
          isGeneratingRef.current = false;
          dispatchRef.current(fileSlice.setIsGeneratingThumbnails(false));
        }
      }
    })();
  }, [fileState.files]); // Only depend on files

  // Ensure export settings are properly initialized
  useEffect(() => {
    if (!config.exportSettings || config.exportSettings.shutterStock === false) {
      dispatch(configSlice.setExportSettings({
        adobeStock: true,
        shutterStock: true,
      }));
    }
  }, [config.exportSettings, dispatch]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
