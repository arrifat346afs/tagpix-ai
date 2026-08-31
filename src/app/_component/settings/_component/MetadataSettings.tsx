import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useConfigStore, setMetadataLimits, setMetadataOptions } from '@/store/configStore'
import { AvoidWordsTextarea } from './AvoidWordsTextarea';
// import { readFile } from '@tauri-apps/plugin-fs';
// import * as path from '@tauri-apps/api/path';

const MetadataSettings = () => {
  const metadataLimits = useConfigStore((state) => state.metadataLimits);
  const metadataOptions = useConfigStore((state) => state.metadataOptions);

  const handleReset = () => {
    setMetadataLimits({
      titleLimit: 200,
      descriptionLimit: 200,
      keywordLimit: 80,
    });
  };


  return (
    <div className="flex flex-col items-center gap-6 ">
      {/* <h2 className="text-2xl font-bold text-gray-400">Metadata Settings</h2> */}
      <div className="w-full max-w-md flex flex-col gap-4">
        <div>
          <div className="flex gap-3 p-2">
            <h4>Title Limit</h4>
            <span className="text-xs ">(characters)</span>
          </div>
          <Input
            type="number"
            value={metadataLimits.titleLimit}
            onChange={(e) =>
              setMetadataLimits({ titleLimit: parseInt(e.target.value || '1') })
            }
            min={1}
            placeholder="e.g., 200"
          />
          <AvoidWordsTextarea
            label="Title Avoid Words"
            avoidWords={metadataOptions.titleAvoidWords}
            onAvoidWordsChange={(words) =>
              setMetadataOptions({ titleAvoidWords: words })
            }
            placeholder="Enter words to avoid in titles (comma-separated)"
          />
        </div>
        <div>
          <div className="flex gap-3 p-2">
            <h4>Description Limit</h4>
            <span className="text-xs ">(characters)</span>
          </div>
          <Input
            type="number"
            value={metadataLimits.descriptionLimit}
            onChange={(e) => setMetadataLimits({ descriptionLimit: parseInt(e.target.value || '1') })}
            min={1}
            placeholder="e.g., 200"
          />
          <AvoidWordsTextarea
            label="Description Avoid Words"
            avoidWords={metadataOptions.descriptionAvoidWords}
            onAvoidWordsChange={(words) =>
              setMetadataOptions({ descriptionAvoidWords: words })
            }
            placeholder="Enter words to avoid in descriptions (comma-separated)"
          />
        </div>
        <div>
          <div className="flex gap-3 p-2">
            <h4>Keyword Limit</h4>
            <span className="text-xs ">(number of keywords)</span>
          </div>
          <Input

            type="number"
            value={metadataLimits.keywordLimit}
            onChange={(e) => setMetadataLimits({ keywordLimit: parseInt(e.target.value || '1') })}
            min={1}
            placeholder="e.g., 80"
          />
          <AvoidWordsTextarea
            label="Keywords Avoid Words"
            avoidWords={metadataOptions.keywordsAvoidWords}
            onAvoidWordsChange={(words) =>
              setMetadataOptions({ keywordsAvoidWords: words })
            }
            placeholder="Enter words to avoid in keywords (comma-separated)"
          />
        </div>
        <div className="flex w-full justify-between gap-4">
          <Button className="flex-1" variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
        </div>
        <div className="text-xs text-center">
          Current: Title={metadataLimits.titleLimit}, Description={metadataLimits.descriptionLimit}, Keywords={metadataLimits.keywordLimit}
        </div>
        <div className="flex justify-between items-center p-2">
          <div className="flex flex-col gap-1">
            <h4>Include Place Names</h4>
            <span className="text-xs ">
              {metadataOptions.includePlaceName
                ? "AI will include location/place names in metadata"
                : "AI will exclude location/place names from metadata"}
            </span>
          </div>
          <Switch
            checked={metadataOptions.includePlaceName}
            onCheckedChange={(checked) =>
              setMetadataOptions({ includePlaceName: checked })
            }
          />
        </div>
        <div className="flex justify-between items-center p-2">
          <div className="flex flex-col gap-1">
            <h4>Auto-select Generated Files</h4>
            <span className="text-xs">
              {metadataOptions.autoSelectGenerated
                ? "Automatically select files during metadata generation"
                : "Don't automatically select files during metadata generation"}
            </span>
          </div>
          <Switch
            checked={metadataOptions.autoSelectGenerated}
            onCheckedChange={(checked) =>
              setMetadataOptions({ autoSelectGenerated: checked })
            }
          />
        </div>

      </div>
    </div>
  )
}

export default MetadataSettings
