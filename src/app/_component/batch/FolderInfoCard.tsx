import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen,
  Play,
  X,
  Image,
  Loader2,
  RotateCcw,
  Check,
  FileText,
} from "lucide-react";
import type { UserTemplate } from "@/app/contexts/SettingsContext";
import type {
  FolderProcessingState,
  ImageProcessingState,
} from "@/store/batchProcessStore";

export type BatchProcessingState =
  | "scanning"
  | "ready"
  | "processing"
  | "completed"
  | "error"
  | "paused";

export interface FolderInfo {
  folderPath: string;
  files: File[];
  imageCount: number;
  videoCount: number;
  thumbnailProgress: number;
  isGeneratingThumbnails: boolean;
  thumbnailsReady: boolean;
  batchProcessingState: BatchProcessingState;
  assignedTemplateId: string | null;
  error?: string;
  id: string;
}

type FolderInfoCardProps = {
  folderInfo: FolderInfo;
  userTemplates: UserTemplate[];
  onLoadThumbnails: () => void;
  onRemove: () => void;
  onRegenerate: () => void;
  onTemplateChange: (templateId: string | null) => void;
  // New props for batch processing progress
  isProcessing?: boolean;
  folderProcessState?: FolderProcessingState;
  currentStage?: string | null;
};

export const FolderInfoCard = ({
  folderInfo,
  userTemplates,
  onLoadThumbnails,
  onRemove,
  onRegenerate,
  onTemplateChange,
  isProcessing = false,
  folderProcessState,
  currentStage,
}: FolderInfoCardProps) => {
  const {
    imageCount,
    videoCount,
    thumbnailProgress,
    isGeneratingThumbnails,
    thumbnailsReady,
    batchProcessingState,
    assignedTemplateId,
    error,
    folderPath,
  } = folderInfo;

  const folderName = folderPath.split(/[/\\]/).pop() || "Unknown Folder";

  const handleClick = () => {
    if (
      !error &&
      thumbnailsReady &&
      !isGeneratingThumbnails &&
      batchProcessingState !== "processing"
    ) {
      onLoadThumbnails();
    }
  };

  // Determine status color based on batch processing state
  const getStatusColor = () => {
    if (error) return "bg-destructive";
    if (batchProcessingState === "processing") return "bg-blue-500";
    if (isGeneratingThumbnails) return "bg-yellow-500";
    if (batchProcessingState === "completed") return "bg-green-500";
    if (batchProcessingState === "ready") return "bg-gray-400";
    return "bg-primary";
  };

  // Get all available templates (presets + user templates)
  const allTemplates = [
    { id: "stock-photo", name: "Stock Photo" },
    { id: "product-catalog", name: "Product Catalog" },
    { id: "social-media", name: "Social Media" },
    ...userTemplates.map((t) => ({ id: t.id, name: t.name })),
  ];

  // Get current template name
  const getCurrentTemplateName = () => {
    const template = allTemplates.find((t) => t.id === assignedTemplateId);
    return template?.name || "Select...";
  };

  // Get status icon based on state
  const getStatusIcon = () => {
    if (error) return <X className="w-3 h-3 text-destructive" />;
    if (batchProcessingState === "processing")
      return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
    if (isGeneratingThumbnails)
      return <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />;
    if (batchProcessingState === "completed")
      return <Check className="w-3 h-3 text-green-500" />;
    if (batchProcessingState === "ready")
      return <Check className="w-3 h-3 text-gray-400" />;
    return <FolderOpen className="w-3 h-3 text-primary" />;
  };

  // Get status text
  const getStatusText = () => {
    if (error) return "Error";
    if (batchProcessingState === "processing")
      return currentStage || "Processing";
    if (isGeneratingThumbnails) return `${Math.round(thumbnailProgress)}%`;
    if (batchProcessingState === "completed") return "Done";
    if (batchProcessingState === "ready") return "Ready";
    return "Scanning...";
  };

  // Calculate progress for processing state
  const getProcessingProgress = () => {
    if (!folderProcessState || batchProcessingState !== "processing") return 0;
    const total = folderProcessState.images.length;
    const completed = folderProcessState.images.filter(
      (img: ImageProcessingState) =>
        img.status === "completed" || img.status === "error",
    ).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const processingProgress = getProcessingProgress();
  const isCurrentlyProcessing =
    batchProcessingState === "processing" ||
    (isProcessing && folderProcessState?.status === "processing");

  return (
    <Card
      className={`
        h-20 w-full flex justify-center relative group cursor-pointer transition-all duration-200 overflow-hidden 
        ${error ? "border-destructive/50" : "hover:border-primary"}
        ${thumbnailsReady && !isGeneratingThumbnails && batchProcessingState !== "processing" ? "hover:bg-primary/5" : ""}
        ${isCurrentlyProcessing ? "border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/20" : ""}
      `}
      onClick={handleClick}
    >
      {/* Status Indicator Bar on Left */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor()}`}
      />

      <CardContent className="p-4 w-full h-full flex flex-col justify-center">
        {/* Main Row */}
        <div className="flex items-center justify-between ">
          {/* Left: Icon and Folder Name */}
          <div className="flex items-center min-w-0 flex-1">
            <div className="shrink-0 w-6 h-6 rounded bg-muted flex items-center justify-center">
              {getStatusIcon()}
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className="font-medium text-sm truncate leading-tight"
                title={folderName}
              >
                {folderName}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Image className="w-2.5 h-2.5 text-blue-500" />
                  {imageCount}
                </span>
                <span className="flex items-center gap-0.5">
                  <Play className="w-2.5 h-2.5 text-green-500" />
                  {videoCount}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Template Dropdown, Status, and Actions */}
          <div
            className="flex items-center gap-2 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Template Dropdown */}
            <Select
              value={assignedTemplateId || "none"}
              onValueChange={(value) =>
                onTemplateChange(value === "none" ? null : value)
              }
              disabled={isCurrentlyProcessing}
            >
              <SelectTrigger className="h-6 text-[10px] min-w-0 flex-1 px-1.5 py-0 gap-1">
                <FileText className="w-3 h-3 shrink-0" />
                <SelectValue placeholder="Template...">
                  {getCurrentTemplateName()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="none" className="text-xs py-1">
                  No template
                </SelectItem>
                {allTemplates.map((template) => (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    className="text-xs py-1"
                  >
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            {error ? (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            ) : (
              <Badge
                variant={
                  error
                    ? "destructive"
                    : isGeneratingThumbnails
                      ? "secondary"
                      : batchProcessingState === "completed"
                        ? "default"
                        : "secondary"
                }
                className={`text-[10px] h-5 px-1.5 shrink-0 ${
                  batchProcessingState === "completed"
                    ? "bg-green-500 hover:bg-green-600 text-white border-0"
                    : ""
                } ${batchProcessingState === "processing" ? "bg-blue-500 hover:bg-blue-600 text-white border-0" : ""}`}
              >
                {getStatusText()}
              </Badge>
            )}

            {/* Remove Button */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isCurrentlyProcessing}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Processing Progress Bar - Only show when processing */}
        {isCurrentlyProcessing && folderProcessState && (
          <div className="mt-2 pt-2 border-t border-dashed">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">
                {
                  folderProcessState.images.filter(
                    (img) => img.status === "completed",
                  ).length
                }{" "}
                of {folderProcessState.images.length} images
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {processingProgress}%
              </span>
            </div>
            <Progress value={processingProgress} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
