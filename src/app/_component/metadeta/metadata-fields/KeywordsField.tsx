import { useState, memo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useFileStore } from "@/store/fileStore";
import { useConfigStore } from "@/store/configStore";
import { useMetadataStore, updateFileMetadata } from "@/store/metadataStore";
import { ScrollArea } from "@/components/ui/scroll-area";

const KeywordsField = memo(function KeywordsField() {
  const selectedFile = useFileStore((state) => state.selectedFile);
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const generatedMetadata = useMetadataStore((state) => state.generatedMetadata);
  const [inputValue, setInputValue] = useState("");

  const metadata = selectedFile
    ? generatedMetadata.find((m) => m.file === selectedFile)?.metadata
    : undefined;
  const keywords = metadata?.keywords || "";
  const keywordArray = keywords
    ? keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  const maxKeywords = metadataLimits.keywordLimit;

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim() && selectedFile) {
      e.preventDefault();

      if (keywordArray.length >= maxKeywords) {
        alert(`Maximum ${maxKeywords} keywords allowed`);
        return;
      }

      const newKeyword = inputValue.trim();

      if (keywordArray.includes(newKeyword)) {
        setInputValue("");
        return;
      }

      const updatedKeywords = [...keywordArray, newKeyword].join(", ");
      updateFileMetadata(selectedFile, { keywords: updatedKeywords });
      setInputValue("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    if (!selectedFile) return;

    const updatedKeywords = keywordArray
      .filter((k) => k !== keywordToRemove)
      .join(", ");
    updateFileMetadata(selectedFile, { keywords: updatedKeywords });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm text-gray-500">Keywords</label>
        <span className="text-xs text-gray-400">
          {keywordArray.length} / {maxKeywords} keywords
        </span>
      </div>

      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder={
          selectedFile
            ? "Add keywords here (press Enter)"
            : "Select a file to view metadata"
        }
        className="mb-3 2xl:text-sm 2xl:h-9"
      />

      <ScrollArea className="h-[15vh] border rounded-md p-0">
        <div className="flex flex-wrap gap-2 min-h-20 p-3">
          {keywordArray.length === 0 ? (
            <span className="text-sm text-gray-400 italic">
              No keywords yet
            </span>
          ) : (
            keywordArray.map((keyword, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="h-6 text-s flex items-center gap-2 cursor-pointer rounded-sm select-none 2xl:text-sm hover:border-accent-foreground border"
              >
                {keyword}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeKeyword(keyword);
                  }}
                >
                 <X className="h-3 w-3 cursor-pointer hover:text-red-400 hover:rotate-90 transition-all ease-in-out  pointer-events-auto" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

export default KeywordsField;