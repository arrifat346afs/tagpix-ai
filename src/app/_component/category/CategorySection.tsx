// import { CategorySelector } from "../common/CategorySelector"
import { useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/app/contexts/SettingsContext";
import { matchCategories } from "@/app/lib/metadata/categoryMatcher";

export const CategorySection = () => {
  const { categories, setCategories, selectedFile, generated } = useSettings();
  const lastProcessedFileRef = useRef<File | null>(null);

  // Get current file's categories or use global categories as fallback
  const currentCategories = selectedFile
    ? generated.getCategories(selectedFile) || categories
    : categories;

  // Auto-populate categories when a file with metadata is selected
  useEffect(() => {
    if (selectedFile) {
      // Only process if this is a different file than the last one we processed
      if (lastProcessedFileRef.current === selectedFile) {
        return;
      }

      const metadata = generated.getMetadata(selectedFile);
      const existingCategories = generated.getCategories(selectedFile);

      // Only auto-match if we don't have categories for this file yet
      if (
        metadata &&
        metadata.title &&
        metadata.keywords &&
        !existingCategories
      ) {
        console.log("🎯 Auto-matching categories for:", selectedFile.name);

        const matches = matchCategories(
          metadata.title,
          metadata.keywords,
          metadata.description
        );

        console.log("📊 Category matches:", matches);
        generated.setFileCategories(selectedFile, matches);
        setCategories(matches); // Also update global state for UI

        // Mark this file as processed
        lastProcessedFileRef.current = selectedFile;
      } else if (existingCategories) {
        // Load existing categories into global state for UI
        setCategories(existingCategories);
        lastProcessedFileRef.current = selectedFile;
      } else {
        console.log("⏳ Waiting for metadata for:", selectedFile.name);
      }
    }
  }, [selectedFile, generated, setCategories]);

  const handleCategoryChange = (
    categoryType: "adobeStock" | "shutterStock1" | "shutterStock2",
    value: string
  ) => {
    const newCategories = { [categoryType]: value };
    setCategories(newCategories); // Update global state for UI
    if (selectedFile) {
      generated.setFileCategories(selectedFile, newCategories); // Save to file-specific storage
    }
  };

  return (
    <div className="select-none flex flex-col gap-4 h-full justify-center items-center @container">
      <div className="w-full flex flex-col gap-2 items-center p-3">
        <h4 className="text-center text-l ">Adobe Stock</h4>
        <Select
          value={currentCategories.adobeStock}
          onValueChange={(value) => handleCategoryChange("adobeStock", value)}
        >
          <SelectTrigger style={{ height: '2rem' }} className="w-full justify-between px-3 font-normal 2xl:text-sm">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <SelectItem value="1">Animals</SelectItem>
            <SelectItem value="2">Buildings</SelectItem>
            <SelectItem value="3">Business</SelectItem>
            <SelectItem value="4">Drinks</SelectItem>
            <SelectItem value="5">Environment</SelectItem>
            <SelectItem value="6">Mind</SelectItem>
            <SelectItem value="7">Food</SelectItem>
            <SelectItem value="8">Graphic</SelectItem>
            <SelectItem value="9">Hobby</SelectItem>
            <SelectItem value="10">Industry</SelectItem>
            <SelectItem value="11">Landscape</SelectItem>
            <SelectItem value="12">Lifestyle</SelectItem>
            <SelectItem value="13">People</SelectItem>
            <SelectItem value="14">Plant</SelectItem>
            <SelectItem value="15">Culture</SelectItem>
            <SelectItem value="16">Science</SelectItem>
            <SelectItem value="17">Social</SelectItem>
            <SelectItem value="18">Sport</SelectItem>
            <SelectItem value="19">Technology</SelectItem>
            <SelectItem value="20">Transport</SelectItem>
            <SelectItem value="21">Travel</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <h4 className="text-center text-l">ShutterStock</h4>
      <div className="flex @max-sm:flex-col gap-4 w-full px-3 ">
        <div className="w-full flex justify-center items-center">
          <Select
            value={currentCategories.shutterStock1}
            onValueChange={(value) =>
              handleCategoryChange("shutterStock1", value)
            }
          >
            <SelectTrigger style={{ height: '2rem' }} className="w-full justify-between px-3 font-normal 2xl:text-sm">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              <SelectItem value="Abstract">Abstract</SelectItem>
              <SelectItem value="Animals/Wildlife">Animals/Wildlife</SelectItem>
              <SelectItem value="Arts">Arts</SelectItem>
              <SelectItem value="Backgrounds/Textures">
                Backgrounds/Textures
              </SelectItem>
              <SelectItem value="Beauty/Fashion">Beauty/Fashion</SelectItem>
              <SelectItem value="Buildings/Landmarks">
                Buildings/Landmarks
              </SelectItem>
              <SelectItem value="Business/Finance">Business/Finance</SelectItem>
              <SelectItem value="Celebrities">Celebrities</SelectItem>
              <SelectItem value="Education">Education</SelectItem>
              <SelectItem value="Food and drink">Food and drink</SelectItem>
              <SelectItem value="Healthcare/Medical">
                Healthcare/Medical
              </SelectItem>
              <SelectItem value="Holidays">Holidays</SelectItem>
              <SelectItem value="Industrial">Industrial</SelectItem>
              <SelectItem value="Interiors">Interiors</SelectItem>
              <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
              <SelectItem value="Nature">Nature</SelectItem>
              <SelectItem value="Objects">Objects</SelectItem>
              <SelectItem value="Parks/Outdoor">Parks/Outdoor</SelectItem>
              <SelectItem value="People">People</SelectItem>
              <SelectItem value="Religion">Religion</SelectItem>
              <SelectItem value="Science">Science</SelectItem>
              <SelectItem value="Signs/Symbols">Signs/Symbols</SelectItem>
              <SelectItem value="Sports/Recreation">
                Sports/Recreation
              </SelectItem>
              <SelectItem value="Technology">Technology</SelectItem>
              <SelectItem value="Transportation">Transportation</SelectItem>
              <SelectItem value="Vintage">Vintage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full flex justify-center items-center">
          <Select
            value={currentCategories.shutterStock2}
            onValueChange={(value) =>
              handleCategoryChange("shutterStock2", value)
            }
          >
            <SelectTrigger style={{ height: '2rem' }} className="w-full justify-between px-3 font-normal 2xl:text-sm">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              <SelectItem value="Abstract">Abstract</SelectItem>
              <SelectItem value="Animals/Wildlife">Animals/Wildlife</SelectItem>
              <SelectItem value="Arts">Arts</SelectItem>
              <SelectItem value="Backgrounds/Textures">
                Backgrounds/Textures
              </SelectItem>
              <SelectItem value="Beauty/Fashion">Beauty/Fashion</SelectItem>
              <SelectItem value="Buildings/Landmarks">
                Buildings/Landmarks
              </SelectItem>
              <SelectItem value="Business/Finance">Business/Finance</SelectItem>
              <SelectItem value="Celebrities">Celebrities</SelectItem>
              <SelectItem value="Education">Education</SelectItem>
              <SelectItem value="Food and drink">Food and drink</SelectItem>
              <SelectItem value="Healthcare/Medical">
                Healthcare/Medical
              </SelectItem>
              <SelectItem value="Holidays">Holidays</SelectItem>
              <SelectItem value="Industrial">Industrial</SelectItem>
              <SelectItem value="Interiors">Interiors</SelectItem>
              <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
              <SelectItem value="Nature">Nature</SelectItem>
              <SelectItem value="Objects">Objects</SelectItem>
              <SelectItem value="Parks/Outdoor">Parks/Outdoor</SelectItem>
              <SelectItem value="People">People</SelectItem>
              <SelectItem value="Religion">Religion</SelectItem>
              <SelectItem value="Science">Science</SelectItem>
              <SelectItem value="Signs/Symbols">Signs/Symbols</SelectItem>
              <SelectItem value="Sports/Recreation">
                Sports/Recreation
              </SelectItem>
              <SelectItem value="Technology">Technology</SelectItem>
              <SelectItem value="Transportation">Transportation</SelectItem>
              <SelectItem value="Vintage">Vintage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
