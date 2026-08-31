import { useState, useEffect } from 'react';
import { useConfigStore, setApiKey } from '@/store/configStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

type Provider = 'gemini' | 'openrouter';

interface ProviderConfig {
  key: Provider;
  label: string;
  placeholder: string;
  description: string;
}

const providers: ProviderConfig[] = [

  {
    key: 'gemini',
    label: 'Google Gemini',
    placeholder: 'AI...',
    description: 'For Gemini Vision and other Google AI models'
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'sk-or-...',
    description: 'Access to multiple AI models through OpenRouter'
  }
];

interface ApiKeyManagementProps {
  compact?: boolean;
  showTitle?: boolean;
}

const ApiKeyManagement = ({ compact = false, showTitle = true }: ApiKeyManagementProps) => {
  const api = useConfigStore((state) => state.api);
  
  // Local state for unsaved changes
  const [localApiKeys, setLocalApiKeys] = useState(api.apiKeys);
  const [showKeys, setShowKeys] = useState<Record<Provider, boolean>>({

    gemini: false,
    openrouter: false
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  // Sync local state when context changes
  useEffect(() => {
    setLocalApiKeys(api.apiKeys);
  }, [api.apiKeys]);

  // Detect unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(localApiKeys) !== JSON.stringify(api.apiKeys);
    setHasUnsavedChanges(hasChanges);
  }, [localApiKeys, api.apiKeys]);

  const handleApiKeyChange = (provider: Provider, value: string) => {
    setLocalApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const toggleShowKey = (provider: Provider) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSave = () => {
    // Save API keys only if changed
    Object.entries(localApiKeys).forEach(([provider, key]) => {
      if (key !== api.apiKeys[provider as Provider]) {
        setApiKey(provider as Provider, key);
      }
    });

    toast.success('API keys saved successfully!');
    
    // Show success indicator
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  };

  const handleCancel = () => {
    setLocalApiKeys(api.apiKeys);
    toast.info('Changes discarded');
  };

  const getKeyStatus = (provider: Provider): 'configured' | 'missing' => {
    return localApiKeys[provider] ? 'configured' : 'missing';
  };

  // Check if no API keys are configured
  const hasNoApiKeys = !Object.values(localApiKeys).some(key => key && key.trim() !== '');

  const content = (
    <div className="space-y-4">
      {/* No API Keys warning */}
      {hasNoApiKeys && !hasUnsavedChanges && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
              No API Keys Configured
            </span>
            <span className="text-xs text-red-600/80 dark:text-red-400/80">
              Please configure at least one API key to use the AI features. Get your API keys from the respective provider websites.
            </span>
          </div>
        </div>
      )}

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
            Unsaved Changes
          </Badge>
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            You have unsaved changes. Click "Save API Keys" to apply them.
          </span>
        </div>
      )}

      {/* Saved indicator */}
      {showSavedIndicator && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
          <Badge variant="outline" className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
            ✓ Saved
          </Badge>
          <span className="text-sm text-green-600 dark:text-green-400">
            API keys saved successfully!
          </span>
        </div>
      )}

      {/* API Key inputs for each provider */}
      {providers.map((provider) => {
        const status = getKeyStatus(provider.key);
        const isConfigured = status === 'configured';

        return (
          <div key={provider.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`apikey-${provider.key}`} className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                {provider.label}
              </Label>
              <Badge 
                variant={isConfigured ? "default" : "outline"}
                className={isConfigured ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30" : ""}
              >
                {isConfigured ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Configured</>
                ) : (
                  <><AlertCircle className="w-3 h-3 mr-1" /> Not Set</>
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
            <div className="relative">
              <Input
                id={`apikey-${provider.key}`}
                type={showKeys[provider.key] ? "text" : "password"}
                value={localApiKeys[provider.key]}
                placeholder={provider.placeholder}
                onChange={(e) => handleApiKeyChange(provider.key, e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey(provider.key)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys[provider.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        );
      })}

      {/* Save and Cancel buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          className="flex-1"
        >
          Save API Keys
        </Button>
        <Button
          onClick={handleCancel}
          variant="outline"
          disabled={!hasUnsavedChanges}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
          <CardDescription>
            Configure your API keys for different AI providers. Keys are stored securely in your browser's local storage.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default ApiKeyManagement;

