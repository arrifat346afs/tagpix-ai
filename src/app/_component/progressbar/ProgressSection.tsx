import { Progress } from "@/components/ui/progress"
import { useFileStore } from "@/store/fileStore";
import { useMetadataStore } from "@/store/metadataStore";


export const ProgressSection = () => {
  const thumbnails = useFileStore((state) => state.thumbnails);
  const generatedMetadata = useMetadataStore((state) => state.generatedMetadata);

  // Calculate how many files have metadata generated
  const totalFiles = thumbnails.length;

  // Only count files that have actual metadata content (not just custom instructions)
  const completedFiles = generatedMetadata.filter(item => {
    const hasContent = item.metadata.title || item.metadata.description || item.metadata.keywords;
    return hasContent;
  }).length;

  const progressValue = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  console.log('📊 Progress:', completedFiles, '/', totalFiles, '=', progressValue.toFixed(1) + '%');
  return (
    <div className="w-full flex flex-col gap-2 bg-muted/50">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Progress value={progressValue} key={`progress-${completedFiles}-${totalFiles}`} className="h-0.5" />
        </div>
        {totalFiles > 0 && (
          <span className="text-sm whitespace-nowrap font-medium pr-3">
            {completedFiles} / {totalFiles}
          </span>
        )}
      </div>
    </div>
  )
}
