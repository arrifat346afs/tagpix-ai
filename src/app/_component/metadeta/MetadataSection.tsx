import TitleField from "./metadata-fields/TitleField";
import { DescriptionField } from "./metadata-fields/DescriptionField";
import KeywordsField from "./metadata-fields/KeywordsField";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useFileStore, getFilePath } from '@/store/fileStore';
import { useConfigStore } from '@/store/configStore';
import { useTemplateStore } from '@/store/templateStore';
import { updateFileMetadata, getMetadata, getCustomInstruction } from '@/store/metadataStore';
import { generateMetadata } from '@/app/lib/ai';
import { embedMetadata } from '@/app/lib/tauri/tauri-commands';
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { CategorySection } from "../category/CategorySection";

export const MetadataSection = () => {
  // State (reactive zustand selectors)
  const selectedFile = useFileStore((state) => state.selectedFile);
  const thumbnails = useFileStore((state) => state.thumbnails);
  const api = useConfigStore((state) => state.api);
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const metadataOptions = useConfigStore((state) => state.metadataOptions);
  const activeTemplateId = useTemplateStore((state) => state.activeTemplateId);
  const userTemplates = useTemplateStore((state) => state.userTemplates);
  const editedDefaultTemplates = useTemplateStore((state) => state.editedDefaultTemplates);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!selectedFile) return;

    const thumbnailItem = thumbnails.find(t => t.file === selectedFile);
    if (!thumbnailItem) {
      alert("Thumbnail not ready yet. Please wait.");
      return;
    }

    const model = api.selectedModel || undefined;
    const provider = api.selectedProvider || undefined;
    const apiKey = provider ? api.apiKeys[provider] : undefined;
    const useLocalModel = api.useLocalModel;
    const localModelName = api.localModelName || undefined;

    if (!useLocalModel && !apiKey) {
      alert('Please configure your API key in Settings');
      return;
    }

    if (useLocalModel && !localModelName) {
      alert('Please select a local model in Settings');
      return;
    }

    // Get custom instruction for this file
    const customInstruction = getCustomInstruction(selectedFile);

    // Get active custom template if one is selected
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

    setIsGenerating(true);
    try {
      const filePath = getFilePath(selectedFile);
      const result = await generateMetadata({
        file: selectedFile,
        filePath: filePath,
        fileNames: [selectedFile.name],
        provider,
        model,
        apiKey,
        useLocalModel,
        localModelName,
        localApiUrl: api.localApiUrl,
        limits: {
          titleLimit: metadataLimits.titleLimit,
          descriptionLimit: metadataLimits.descriptionLimit,
          keywordLimit: metadataLimits.keywordLimit,
        },
        includePlaceName: metadataOptions.includePlaceName,
        customTemplate: customTemplate,
        customInstruction: customInstruction,
        avoidWords: {
          titleAvoidWords: metadataOptions.titleAvoidWords,
          keywordsAvoidWords: metadataOptions.keywordsAvoidWords,
          descriptionAvoidWords: metadataOptions.descriptionAvoidWords,
        },
      });

      updateFileMetadata(selectedFile, {
        title: result.title,
        description: result.description,
        keywords: result.keywords,
      });
    } catch (error) {
      console.error("Failed to generate metadata:", error);
      alert("Failed to generate metadata. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error("No file selected");
      return;
    }

    const filePath = getFilePath(selectedFile);
    if (!filePath) {
      toast.error("File path not found. Please re-upload the file.");
      return;
    }

    const metadata = getMetadata(selectedFile);
    if (!metadata) {
      toast.error("No metadata to save");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedFile.type === 'image/svg+xml') {
        console.log(`ℹ️ Skipping metadata embedding for SVG file: ${selectedFile.name}`);
        toast.info('Metadata saved to memory — use CSV export for SVG files');
        setIsSaving(false);
        return;
      }

      console.log(`💾 Saving metadata for ${selectedFile.name}...`);

      const embedRequest = {
        file_path: filePath,
        title: metadata.title || undefined,
        description: metadata.description || undefined,
        keywords: metadata.keywords || undefined,
      };

      const result = await embedMetadata(embedRequest);

      if (result.success) {
        console.log(`✅ Successfully saved metadata: ${result.message}`);
        toast.success(`Metadata saved to ${selectedFile.name}`);
      } else {
        console.error(`❌ Failed to save metadata: ${result.message}`);
        toast.error(`Failed to save: ${result.message}`);
      }
    } catch (error) {
      console.error("Error saving metadata:", error);
      toast.error("An error occurred while saving metadata");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollArea className="h-full w-full pb-0 pt-2 pl-2 pr-2 2xl:pt-4 2xl:pl-2 2xl:pr-2">
      <div className="flex flex-col gap-4 p-2 h-full">
        <TitleField />
        <DescriptionField />
        <KeywordsField />

        <div className="flex gap-2 mt-2">
          <Button
            onClick={handleGenerate}
            disabled={!selectedFile || isGenerating}
            className="flex-1"
            variant="outline"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>

          <Button
            onClick={handleSave}
            disabled={!selectedFile || isSaving}
            className="flex-1"
            variant="default"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
         <CategorySection />
      </div>
    </ScrollArea>
  );
};
