import { Textarea } from "@/components/ui/textarea";
import { useFileStore } from '@/store/fileStore';
import { useConfigStore } from '@/store/configStore';
import { useMetadataStore, updateFileMetadata } from '@/store/metadataStore';
import { extractKeywordsFromTitle } from "@/app/lib/metadata/keywordUtils";
import { memo } from "react";


function TitleField() {
  const selectedFile = useFileStore((state) => state.selectedFile);
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const generatedMetadata = useMetadataStore((state) => state.generatedMetadata);

  const metadata = selectedFile
    ? generatedMetadata.find((m) => m.file === selectedFile)?.metadata
    : undefined;
  const title = metadata?.title || '';

  const maxLength = metadataLimits.titleLimit;
  const currentLength = title.length;
  const isOverLimit = currentLength > maxLength;

  const handleChange = (e: any) => {
    if (selectedFile) {
      const newTitle = e.target.value;

      // Get existing keywords
      const currentKeywords = metadata?.keywords || '';
      const existingKeywordList = currentKeywords.split(',').map(k => k.trim()).filter(Boolean);

      // Extract new keywords from title
      const titleKeywords = extractKeywordsFromTitle(newTitle);

      // Merge keywords: title keywords first, then existing ones
      // Use Set to remove duplicates
      const mergedKeywords = Array.from(new Set([...titleKeywords, ...existingKeywordList]));

      // Apply limit if needed (optional, but good practice)
      const limitedKeywords = mergedKeywords.slice(0, metadataLimits.keywordLimit);

      updateFileMetadata(selectedFile, {
        title: newTitle,
        keywords: limitedKeywords.join(', ')
      });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm text-gray-500 ">Title</label>
        <span className={`text-xs ${isOverLimit ? 'text-gray-200 font-bold' : 'text-gray-400'}`}>
          {currentLength} / {maxLength} characters
        </span>
      </div>
      <Textarea
        value={title}
        onChange={handleChange}
        placeholder={selectedFile ? "Generate metadata for this file..." : "Select a file to view metadata"}
        className=" 2xl:h-15 2xl:text-sm"
      />
    </div>
  );
}
export default memo(TitleField); 