import { Textarea } from "@/components/ui/textarea";
import { useFileStore } from '@/store/fileStore';
import { useConfigStore } from '@/store/configStore';
import { useMetadataStore, updateFileMetadata } from '@/store/metadataStore';
import { memo } from "react";

export const DescriptionField = memo(function DescriptionField() {
  const selectedFile = useFileStore((state) => state.selectedFile);
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const generatedMetadata = useMetadataStore((state) => state.generatedMetadata);

  const metadata = selectedFile
    ? generatedMetadata.find((m) => m.file === selectedFile)?.metadata
    : undefined;
  const description = metadata?.description || '';

  const maxLength = metadataLimits.descriptionLimit;
  const currentLength = description.length;
  const isOverLimit = currentLength > maxLength;

  const handleChange = (e: any) => {
    if (selectedFile) {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        updateFileMetadata(selectedFile, { description: newValue });
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm text-gray-500">Description</label>
        <span className={`text-xs ${isOverLimit ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
          {currentLength} / {maxLength} characters
        </span>
      </div>
      <Textarea
        value={description}
        onChange={handleChange}
        placeholder={selectedFile ? "Generate metadata for this file..." : "Select a file to view metadata"}
        className=" 2xl:h-25 2xl:text-sm"
      />
    </div>
  );
});