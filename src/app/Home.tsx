import { ActionsSection } from "./_component/action/ ActionsSection";
// import { CategorySection } from "./_component/category/CategorySection";
import FileSection from "./_component/file-preview/FileSection";
import { MetadataSection } from "./_component/metadeta/MetadataSection";
import { ProgressSection } from "./_component/progressbar/ProgressSection";
import ThumbnailSection from "./_component/thumbnail/ThumbnailSection";
import { useFileStore, setFiles, setSelectedFile } from "@/store/fileStore";
import { useThumbnailAutoGeneration } from "./hooks/useThumbnailAutoGeneration";
import { Separator } from "@/components/ui/separator";

// import LeftTabs from "./_component/TabGroup/LeftTabs";
const PROGRESS_BAR_HEIGHT = 56; // px
export const Home = () => {
  const selectedFile = useFileStore((state) => state.selectedFile);

  // Auto-generates thumbnails for newly added files
  // (was a side effect inside the removed SettingsProvider)
  useThumbnailAutoGeneration();

  const handleFilesSelected = (files: File[]) => {
    setFiles(files);
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden select-none">

      <div className="flex min-h-0" style={{ flex: "75 1 0%" }}>

        <div className="h-full overflow-hidden" style={{ flex: "66 1 0%" }}>
          <FileSection file={selectedFile} />
        </div>

        <Separator orientation="vertical" />

        <div className="h-full overflow-y-auto" style={{ flex: "34 1 0%" }}>
          <MetadataSection />
        </div>

      </div>

      <Separator />

      <div
        className="w-full shrink-0 overflow-hidden flex items-center"
        style={{ flex: "5 0 0%", minHeight: "40px", maxHeight: "52px" }}
      >
        <ActionsSection onFilesSelected={handleFilesSelected} />
      </div>

      <Separator />

      <div className="w-full flex flex-col" style={{ flex: "20 1 0%" }}>

        <div
          className="w-full overflow-hidden"
          style={{ flex: "1 1 0%", minHeight: 0 }}
        >
          <ThumbnailSection onSelectFile={setSelectedFile} />
        </div>


        <div
          className="w-full shrink-0"
          style={{ height: `${PROGRESS_BAR_HEIGHT}px` }}
        >
          <ProgressSection />
        </div>

      </div>

    </div>

  );
};
