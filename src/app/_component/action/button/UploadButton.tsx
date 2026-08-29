import { Button } from "@/components/ui/button";
import { useState } from "react";
import React from "react";
import { useSettings } from "@/app/contexts/SettingsContext";
import { UploadIcon } from "@/components/ui/upload";
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from "@tauri-apps/plugin-fs";
import { readExifMetadata } from "@/app/lib/tauri/tauri-commands";
import { VECTOR_MIME_TYPE } from "@/app/lib/thumbnail/vectorSupport";

// Convert a file path to a File object with proper MIME type
// For videos, we create a lightweight File without loading content (backend reads from path)
const fileFromPath = async (path: string, loadContent: boolean = true): Promise<File> => {
  const name = path.split("/").pop() ?? "file";
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const isVideo = ['mp4', 'mov', 'webm'].includes(ext);
  
  if (isVideo && !loadContent) {
    // For videos, create lightweight placeholder - content not needed, backend reads from path
    const mimeType = isVideo 
      ? (ext === 'mov' ? 'video/quicktime' : `video/${ext}`)
      : '';
    return new File([], name, { type: mimeType });
  }
  
  const data = await readFile(path);
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
    'ai': VECTOR_MIME_TYPE, 'eps': VECTOR_MIME_TYPE,
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm',
  };
  return new File([data], name, { type: mimeTypes[ext] || '' });
};

type UploadButtonProps = {
  onFilesSelected: (files: File[]) => void;
};

// How many files to read from disk in parallel
const UPLOAD_CONCURRENCY = 5;

const UploadButtonComponent = ({ }: UploadButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { setHasAttemptedGeneration, setFilePath, generated, setFiles, addFiles } = useSettings();

  const handleClick = async () => {
    console.log("🖱️  Upload button clicked - opening Tauri file dialog");
    const result = await open({
      multiple: true,
      filters: [
        {
          name: "Media",
          extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "ai", "eps", "mp4", "mov", "webm"]
        }
      ]
    });

    if (!result) {
      console.log("   User cancelled file selection");
      return;
    }

    const paths = Array.isArray(result) ? result : [result];
    console.log("   Selected paths:", paths.length);

    // Clear existing files immediately so the UI resets right away
    setFiles([]);
    setHasAttemptedGeneration(false);

    // Separate images and videos - process videos one at a time to avoid UI hang
    const imagePaths: string[] = [];
    const videoPaths: string[] = [];
    
    for (const path of paths) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      if (['mp4', 'mov', 'webm'].includes(ext)) {
        videoPaths.push(path);
      } else {
        imagePaths.push(path);
      }
    }

    console.log(`📁 Processing: ${imagePaths.length} images, ${videoPaths.length} videos`);

    // Process images with high concurrency
    const imageQueue = [...imagePaths];
    const processImage = async (path: string) => {
      const file = await fileFromPath(path);
      setFilePath(file, path);
      addFiles([file]);
      
      if (file.type !== 'image/svg+xml') {
        readExifMetadata(path).then(exifData => {
          if (exifData.title || exifData.description || exifData.keywords) {
            generated.setMetadata(file, {
              title: exifData.title || '',
              description: exifData.description || '',
              keywords: exifData.keywords || ''
            });
          }
        }).catch(() => {});
      }
    };

    await Promise.all(
      Array(Math.min(UPLOAD_CONCURRENCY, imagePaths.length)).fill(null).map(async () => {
        while (imageQueue.length > 0) {
          const path = imageQueue.shift();
          if (path) await processImage(path);
        }
      })
    );

    // Process videos one at a time to prevent UI freeze
    // Use lightweight File objects - no content loaded, backend reads from path directly
    for (const path of videoPaths) {
      const file = await fileFromPath(path, false); // Don't load video content
      setFilePath(file, path);
      addFiles([file]);
      
      readExifMetadata(path).then(exifData => {
        if (exifData.title || exifData.description || exifData.keywords) {
          generated.setMetadata(file, {
            title: exifData.title || '',
            description: exifData.description || '',
            keywords: exifData.keywords || ''
          });
        }
      }).catch(() => {});
    }

    console.log(`✅ All ${paths.length} files queued for display`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Button
        onClick={handleClick}
        variant={"ghost"}
        className="gap-2 group h-full max-h-10 min-h-8 2xl:w-30 2xl:max-h-13 2xl:text-sm"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <UploadIcon isHovered={isHovered} />
        Upload
      </Button>
    </div>
  );
};

export const UploadButton = React.memo(UploadButtonComponent);
  

