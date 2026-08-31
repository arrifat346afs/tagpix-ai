import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import {
  useFileStore,
  addFiles,
  removeFile,
  setFilePath,
  addThumbnail,
} from "@/store/fileStore";
import { useUiStore, setHasAttemptedGeneration } from "@/store/uiStore";
import { useConfigStore } from "@/store/configStore";
import { useTemplateStore } from "@/store/templateStore";
import {
  useMetadataStore,
  updateFileMetadata as setMetadata,
  getCustomInstruction,
} from "@/store/metadataStore";
import { MdOutlineImageNotSupported } from "react-icons/md";
import { Upload } from "lucide-react";
import { ThumbnailScrollContainer } from "./ThumbnailScrollContainer";
import { CustomInstructionDialog } from "./CustomInstructionDialog";
import { generateMetadata } from "@/app/lib/ai";
import { generateImageThumbnail } from "@/app/lib/thumbnailGenerator";
import { readExifMetadata } from "@/app/lib/tauri/tauri-commands";
import { ThumbnailItem } from "./ThumbnailItem";
import { useAutoScroll, useKeyboardAutoScroll, useDragAndDrop, useVirtualization, useKeyboardNavigation } from "./hooks";

type ThumbnailSectionProps = {
  onSelectFile: (file: File) => void;
};

const ThumbnailSection = ({ onSelectFile }: ThumbnailSectionProps) => {
  // State (reactive zustand selectors)
  const files = useFileStore((state) => state.files);
  const thumbnails = useFileStore((state) => state.thumbnails);
  const filePaths = useFileStore((state) => state.filePaths);
  const selectedFile = useFileStore((state) => state.selectedFile);
  const isGeneratingThumbnails = useFileStore((state) => state.isGeneratingThumbnails);
  const hasAttemptedGeneration = useUiStore((state) => state.hasAttemptedGeneration);
  const activeTab = useUiStore((state) => state.activeLeftTab);
  const api = useConfigStore((state) => state.api);
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const metadataOptions = useConfigStore((state) => state.metadataOptions);
  const activeTemplateId = useTemplateStore((state) => state.activeTemplateId);
  const userTemplates = useTemplateStore((state) => state.userTemplates);
  const editedDefaultTemplates = useTemplateStore((state) => state.editedDefaultTemplates);
  const generatedMetadata = useMetadataStore((state) => state.generatedMetadata);

  const thumbnailRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Custom instruction dialog state
  const [customInstructionDialogOpen, setCustomInstructionDialogOpen] = useState(false);
  const [customInstructionFile, setCustomInstructionFile] = useState<File | null>(null);

  // Regenerating state - track which file is being regenerated
  const [regeneratingFile, setRegeneratingFile] = useState<File | null>(null);

  // Setup drag and drop
  const { isDragActive } = useDragAndDrop({
    activeTab,
    // Per-file callback: fires as soon as each individual file is read from disk,
    // so the loading thumbnail appears instantly without waiting for the whole batch.
    onFileAdded: useCallback((file: File) => {
      addFiles([file]);
      setHasAttemptedGeneration(false);
      
      // Generate instant thumbnail in background
      const filePath = filePaths.get(file);
      
      // Generate async without blocking
      generateImageThumbnail(file, filePath).then((thumbnailUrl) => {
        if (thumbnailUrl) {
          addThumbnail({ file, thumbnailUrl, previewUrl: null });
        }
      }).catch(() => {});
    }, [addFiles, setHasAttemptedGeneration, filePaths]),
    // Legacy batch fallback (used when onFileAdded is not provided)
    // Use addFiles (stable) instead of setFiles([...files, ...newFiles]) so that
    // this callback doesn't get a new reference every time `files` changes.
    onFilesAdded: useCallback((newFiles: File[]) => {
      if (newFiles.length > 0) {
        addFiles(newFiles);
        setHasAttemptedGeneration(false);
      }
    }, [addFiles, setHasAttemptedGeneration]),
    onFilePathStored: setFilePath,
    onExifDataFound: useCallback(async (file: File, path: string) => {
      if (file.type === 'image/svg+xml') {
        console.log(`ℹ️ Skipping EXIF read for SVG file: ${file.name}`);
        return;
      }
      try {
        console.log(`📸 Reading EXIF metadata for dropped file: ${file.name}`);
        const exifData = await readExifMetadata(path);

        if (exifData.title || exifData.description || exifData.keywords) {
          console.log(`✅ Found embedded metadata for ${file.name} - Title: ${exifData.title ? 'yes' : 'no'}, Description: ${exifData.description ? 'yes' : 'no'}, Keywords: ${exifData.keywords ? 'yes' : 'no'}`);

          // Populate metadata fields with EXIF data
          setMetadata(file, {
            title: exifData.title || '',
            description: exifData.description || '',
            keywords: exifData.keywords || ''
          });
        } else {
          console.log(`ℹ️ No embedded metadata found for ${file.name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to read EXIF metadata for ${file.name}:`, error);
        // Continue without EXIF data - not a fatal error
      }
    // Use setMetadata (stable) instead of generated (object ref changes on every metadata update)
    }, [setMetadata]),
  });

  // Setup virtualization
  const { 
    filesToRender, 
    totalWidth, 
    leftOffset, 
    onScroll, 
    updateVisibleRangeForSelection,
    shouldVirtualize 
  } = useVirtualization({ files: files || [], selectedFile });

  // Setup keyboard navigation (always enabled, with circular wrap)
  useKeyboardNavigation({
    files: files || [],
    selectedFile,
    onSelectFile,
    onIndexChange: updateVisibleRangeForSelection,
    enabled: files && files.length > 0,
  });

  // Setup auto-scroll for AI metadata generation only
  useAutoScroll({
    selectedFile,
    autoSelectEnabled: metadataOptions.autoSelectGenerated,
    thumbnailRefs,
  });

  // Setup auto-scroll for keyboard navigation (always active)
  useKeyboardAutoScroll({
    selectedFile,
    thumbnailRefs,
  });

  // Update visible range when selected file changes
  useEffect(() => {
    updateVisibleRangeForSelection();
  }, [selectedFile, updateVisibleRangeForSelection]);

  // Create lookup maps for O(1) access - use file name as key for stable lookup
  const thumbnailMap = useMemo(() => {
    const map = new Map<string, { thumbnailUrl: string }>();
    thumbnails.forEach(t => map.set(t.file.name, t));
    return map;
  }, [thumbnails]);

  const metadataMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (generatedMetadata) {
      generatedMetadata.forEach(item => {
        const hasContent = item.metadata.title || item.metadata.description || item.metadata.keywords;
        if (hasContent) {
          map.set(item.file.name, true);
        }
      });
    }
    return map;
  }, [generatedMetadata]);

  // Files that have a custom instruction (reactive lookup for render path)
  const customInstructionFiles = useMemo(() => {
    const set = new Set<File>();
    generatedMetadata.forEach(item => {
      if (item.customInstruction) {
        set.add(item.file);
      }
    });
    return set;
  }, [generatedMetadata]);

  // Regenerate metadata handler
  const handleRegenerate = useCallback(async (file: File) => {
    const thumbnailItem = thumbnails.find(t => t.file === file);
    if (!thumbnailItem) {
      alert("Thumbnail not ready yet. Please wait.");
      return;
    }

    const model = api.selectedModel || undefined;
    const provider = api.selectedProvider || undefined;
    const apiKey = provider ? api.apiKeys[provider] : undefined;

    // Check if using local model or API key is configured
    if (!api.useLocalModel && !apiKey) {
      alert('Please configure your API key in Settings');
      return;
    }

    const customInstruction = getCustomInstruction(file);
    let customTemplate: string | undefined;
    if (activeTemplateId) {
      // Check user templates first
      const userTemplate = userTemplates.find(t => t.id === activeTemplateId);
      if (userTemplate) {
        customTemplate = userTemplate.template;
      } else {
        // Check edited default templates
        const editedDefault = editedDefaultTemplates?.find(t => t.id === activeTemplateId);
        if (editedDefault) {
          customTemplate = editedDefault.template;
        }
      }
    }

    setRegeneratingFile(file);
    try {
      const filePath = filePaths.get(file);
      const result = await generateMetadata({
        file: file,
        filePath: filePath,
        fileNames: [file.name],
        provider,
        model,
        apiKey,
        useLocalModel: api.useLocalModel,
        localModelName: api.localModelName,
        localApiUrl: api.localApiUrl,
        limits: {
          titleLimit: metadataLimits.titleLimit,
          descriptionLimit: metadataLimits.descriptionLimit,
          keywordLimit: metadataLimits.keywordLimit,
        },
        includePlaceName: metadataOptions.includePlaceName,
        customTemplate: customTemplate,
        customInstruction: customInstruction,
      });

      setMetadata(file, {
        title: result.title,
        description: result.description,
        keywords: result.keywords,
      });
    } catch (error) {
      console.error("Failed to generate metadata:", error);
      alert("Failed to generate metadata. Check console for details.");
    } finally {
      setRegeneratingFile(null);
    }
  }, [thumbnails, api, metadataLimits, metadataOptions, activeTemplateId, userTemplates, editedDefaultTemplates]);

  // Memoize callback handlers
  const handleSelectFile = useCallback((file: File) => {
    onSelectFile(file);
  }, [onSelectFile]);

  const handleDeleteFile = useCallback((file: File) => {
    removeFile(file);
  }, [removeFile]);

  const handleOpenCustomInstruction = useCallback((file: File) => {
    setCustomInstructionFile(file);
    setCustomInstructionDialogOpen(true);
  }, []);

  const handleSetRef = useCallback((file: File) => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        thumbnailRefs.current.set(file.name, el);
      } else {
        thumbnailRefs.current.delete(file.name);
      }
    };
  }, []);

  // Development logging (throttled)
  if (import.meta.env.DEV && files?.length !== undefined) {
    const logKey = `thumb_${files?.length}_${thumbnails?.length}`;
    const windowWithLog = window as unknown as { __lastThumbLog?: string };
    if (windowWithLog.__lastThumbLog !== logKey) {
      windowWithLog.__lastThumbLog = logKey;
      console.log(`ThumbnailSection - files: ${files?.length}, thumbnails: ${thumbnails?.length}`);
    }
  }

  return (
    <div className="w-full relative" data-dropzone="thumbnail">
      {(!files || files.length === 0) && (
        <div className="p-2">
          <div className={`h-[20vh] w-[17vw] border-2 border-dashed rounded-md flex justify-center items-center text-7xl transition-all duration-200 ${
            isDragActive
              ? "border-primary bg-primary/10 scale-105"
              : "border-muted-foreground/25"
          }`}>
            <MdOutlineImageNotSupported />
          </div>
          {isDragActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Upload className="w-16 h-16 text-primary mb-4 animate-bounce" />
              <p className="text-xl font-semibold text-primary">
                Drop files here to add them
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Images and videos will be added to your collection
              </p>
            </div>
          )}
        </div>
      )}

      {files && files.length > 0 && (
          <ThumbnailScrollContainer
            className="p-2 w-full"
            scrollRef={scrollContainerRef}
            onScroll={shouldVirtualize ? onScroll : undefined}
            style={{
              width: shouldVirtualize ? `${totalWidth}px` : undefined,
              paddingLeft: shouldVirtualize ? `${leftOffset}px` : undefined,
            }}
          >
            <div
              className={`flex space-x-4 px-2 py-2 pb-4 relative ${
                isDragActive ? ' border-2 border-dashed border-primary bg-primary/5 rounded-lg' : ''
              }`}
            >
              {filesToRender.map(({ file, index }) => {
                const thumbnail = thumbnailMap.get(file.name);
                // Show loading spinner for any file that doesn't have a thumbnail yet.
                // We only add valid media files to state, so no thumbnail = still generating.
                const isGenerating = !thumbnail;
                const hasMetadata = metadataMap.has(file.name);
                const isSelected = selectedFile === file;
                const hasCustomInstruction = customInstructionFiles.has(file);
                const isRegenerating = regeneratingFile === file;

                return (
                  <ThumbnailItem
                    key={`${file.name}-${index}`}
                    file={file}
                    thumbnail={thumbnail}
                    isGenerating={isGenerating}
                    isSelected={isSelected}
                    hasMetadata={hasMetadata}
                    hasAttemptedGeneration={hasAttemptedGeneration}
                    hasCustomInstruction={hasCustomInstruction}
                    isRegenerating={isRegenerating}
                    onSelect={() => handleSelectFile(file)}
                    onDelete={() => handleDeleteFile(file)}
                    onOpenCustomInstruction={() => handleOpenCustomInstruction(file)}
                    onRegenerate={() => handleRegenerate(file)}
                    onRef={handleSetRef(file)}
                  />
                );
              })}
              
              {/* Drag overlay for when files exist */}
              {isDragActive && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-primary rounded-lg animate-in fade-in duration-200 z-10">
                  <Upload className="w-16 h-16 text-primary mb-4 animate-bounce" />
                  <p className="text-xl font-semibold text-primary">
                    Drop files here to add them
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Images and videos will be added to your collection
                  </p>
                </div>
              )}
            </div>
          </ThumbnailScrollContainer>
      )}

      {/* Progress indicator for large batches */}
      {files && files.length > 50 && isGeneratingThumbnails && (
        <div className="absolute bottom-2 right-2 bg-gray-800/90 text-white text-xs px-3 py-1 rounded-full">
          Generating thumbnails: {thumbnails.length}/{files.length}
        </div>
      )}

      {/* Custom Instruction Dialog */}
      <CustomInstructionDialog
        file={customInstructionFile}
        isOpen={customInstructionDialogOpen}
        onClose={() => {
          setCustomInstructionDialogOpen(false);
          setCustomInstructionFile(null);
        }}
      />
    </div>
  );
};

export default ThumbnailSection;
