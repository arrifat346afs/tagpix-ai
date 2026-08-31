import { CiImageOn } from "react-icons/ci";
import { useState, useEffect } from "react";
import { useFileStore } from "@/store/fileStore";
import { ApiCostBadge } from "./ApiCostBadge";

type FileSectionProps = {
  file: File | null;
};

export default function FileSection({ file }: FileSectionProps) {
  const thumbnails = useFileStore((state) => state.thumbnails);
  const thumbnailItem = thumbnails.find((t) => t.file === file);
  const lowResUrl = thumbnailItem?.thumbnailUrl;

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isImage = file?.type.startsWith("image/") ?? false;
  const isVideo = file?.type.startsWith("video/") ?? false;

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setIsLoaded(false);
      return;
    }
    setIsLoaded(false);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) {
    return (
      <div className="w-full h-full flex items-center justify-center text-6xl text-accent">
        <CiImageOn />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      {(isImage || isVideo) && (
        <div className="relative w-full h-full p-10">
          {lowResUrl && !isLoaded && (
            <img
              src={lowResUrl}
              alt={file.name}
              className="absolute inset-0 w-full h-full object-contain blur-sm opacity-80 rounded-2xl"
            />
          )}

          {isImage && objectUrl && (
            <img
              src={objectUrl}
              alt={file.name}
              className="w-full h-full object-contain rounded-2xl"
              onLoad={() => setIsLoaded(true)}
            />
          )}

          {isVideo && objectUrl && (
            <video
              src={objectUrl}
              autoPlay
              muted
              playsInline
              controls
              className="w-full h-full object-contain rounded-2xl"
              onLoadedData={() => setIsLoaded(true)}
            />
          )}
        </div>
      )}

      <ApiCostBadge className="absolute bottom-4 left-1/2 -translate-x-1/2" />
    </div>
  );
}
