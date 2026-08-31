import { Button } from "@/components/ui/button";
import { useUiStore, setGenerationProgress } from "@/store/uiStore";
import { cancelGeneration } from "@/app/lib/generation/generationControl";
import { X } from "lucide-react";
import React from "react";

const CancelButtonComponent = () => {
  const isGenerating = useUiStore((state) => state.generationProgress.isGenerating);

  const handleCancel = () => {
    console.log('🛑 Cancel requested from CancelButton');
    // Abort in-flight HTTP requests immediately, then stop scheduling new ones
    cancelGeneration();
    setGenerationProgress({ cancelRequested: true });
  };

  return (
    <Button
      onClick={handleCancel}
      variant="ghost"
      className="gap-2 group h-full max-h-10 min-h-8 2xl:w-30 2xl:max-h-13 2xl:text-sm"
      disabled={!isGenerating}
    >
      <X className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:rotate-90 2xl:text-sm" />
      Cancel
    </Button>
  );
};

export const CancelButton = React.memo(CancelButtonComponent);

