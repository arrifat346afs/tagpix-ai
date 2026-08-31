import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCustomInstruction, updateCustomInstruction } from "@/store/metadataStore";

type CustomInstructionDialogProps = {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
};

export const CustomInstructionDialog = ({
  file,
  isOpen,
  onClose,
}: CustomInstructionDialogProps) => {
  const [instruction, setInstruction] = useState("");

  // Load existing instruction when dialog opens
  useEffect(() => {
    if (file && isOpen) {
      const existingInstruction = getCustomInstruction(file);
      setInstruction(existingInstruction || "");
    }
  }, [file, isOpen]);

  const handleSave = () => {
    if (file) {
      updateCustomInstruction(file, instruction);
      onClose();
    }
  };

  const handleClear = () => {
    if (file) {
      updateCustomInstruction(file, "");
      setInstruction("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Custom Instruction</DialogTitle>
          <DialogDescription>
            Add specific instructions for AI metadata generation for this image.
            This will be used when generating metadata for{" "}
            <span className="font-semibold">{file?.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g., Focus on the sunset colors, mention the beach location, emphasize the peaceful atmosphere..."
            className="min-h-[150px]"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {instruction.length} characters
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

