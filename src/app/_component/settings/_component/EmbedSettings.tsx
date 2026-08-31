import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConfigStore, setEmbedSettings } from '@/store/configStore';

export const EmbedSettings = () => {
  const embedSettings = useConfigStore((state) => state.embedSettings);

  const handleEnabledChange = (enabled: boolean) => {
    setEmbedSettings({ enabled });
  };

  const handleFieldChange = (field: 'title' | 'description' | 'keywords', value: boolean) => {
    setEmbedSettings({
      fields: {
        ...embedSettings.fields,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="embed-enabled" className="text-base font-medium">
              Enable Metadata Embedding
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically embed AI-generated metadata into your image and video files using exiftool
            </p>
          </div>
          <Switch
            id="embed-enabled"
            checked={embedSettings.enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>
      </div>

      {embedSettings.enabled && (
        <div className="space-y-4 border-t pt-4">
          <Label className="text-base font-medium">Embedding Fields</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which metadata fields to embed into your files
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="embed-title" className="text-sm font-medium">
                  Title
                </Label>
                <p className="text-xs text-muted-foreground">
                  Embed title as XMP:Title, IPTC:ObjectName
                </p>
              </div>
              <Switch
                id="embed-title"
                checked={embedSettings.fields.title}
                onCheckedChange={(checked) => handleFieldChange('title', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="embed-description" className="text-sm font-medium">
                  Description
                </Label>
                <p className="text-xs text-muted-foreground">
                  Embed description as XMP:Description, EXIF:ImageDescription
                </p>
              </div>
              <Switch
                id="embed-description"
                checked={embedSettings.fields.description}
                onCheckedChange={(checked) => handleFieldChange('description', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="embed-keywords" className="text-sm font-medium">
                  Keywords
                </Label>
                <p className="text-xs text-muted-foreground">
                  Embed keywords as XMP:Subject, IPTC:Keywords
                </p>
              </div>
              <Switch
                id="embed-keywords"
                checked={embedSettings.fields.keywords}
                onCheckedChange={(checked) => handleFieldChange('keywords', checked)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
