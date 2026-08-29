import { useState, useEffect } from 'react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { fetchOpenRouterModels, fetchGeminiModels, fetchLocalModels, checkLocalModelConnection, type ModelInfo } from '@/app/lib/models/modelFetcher';
import { ModelSelector } from './ModelSelector';

type Provider = 'openai' | 'gemini' | 'mistral' | 'groq' | 'openrouter';

const ApiSettings = () => {
  const { api } = useSettings();

  // Local state for unsaved changes
  const [localProvider, setLocalProvider] = useState<Provider | ''>(api.selectedProvider);
  const [localModel, setLocalModel] = useState<string>(api.selectedModel);
  const [localApiKeys, setLocalApiKeys] = useState(api.apiKeys);
  const [localRequestDelay, setLocalRequestDelay] = useState(api.requestDelay);
  const [localProcessingMode, setLocalProcessingMode] = useState(api.processingMode);
  const [localParallelWorkers, setLocalParallelWorkers] = useState(api.parallelWorkers);
  const [localUseLocalModel, setLocalUseLocalModel] = useState(api.useLocalModel);
  const [localLocalModelName, setLocalLocalModelName] = useState(api.localModelName);
  const [localLocalApiUrl, setLocalLocalApiUrl] = useState(api.localApiUrl);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [localModels, setLocalModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingLocalModels, setIsLoadingLocalModels] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [localModelConnected, setLocalModelConnected] = useState(false);

  const providers = [
    // { value: 'openai', label: 'OpenAI' },
    { value: 'gemini', label: 'Google' },
    { value: 'openrouter', label: 'OpenRouter' },
  ];

  // Sync local state when context changes (e.g., on mount or external updates)
  useEffect(() => {
    setLocalProvider(api.selectedProvider);
    setLocalModel(api.selectedModel);
    setLocalApiKeys(api.apiKeys);
    setLocalRequestDelay(api.requestDelay);
    setLocalProcessingMode(api.processingMode);
    setLocalParallelWorkers(api.parallelWorkers);
    setLocalUseLocalModel(api.useLocalModel);
    setLocalLocalModelName(api.localModelName);
    setLocalLocalApiUrl(api.localApiUrl);
  }, [api.selectedProvider, api.selectedModel, api.apiKeys, api.requestDelay, api.processingMode, api.parallelWorkers, api.useLocalModel, api.localModelName, api.localApiUrl]);

  // Detect unsaved changes (excluding API keys and processing mode as they're managed separately)
  useEffect(() => {
    const hasChanges =
      localProvider !== api.selectedProvider ||
      localModel !== api.selectedModel ||
      localRequestDelay !== api.requestDelay ||
      localParallelWorkers !== api.parallelWorkers ||
      localUseLocalModel !== api.useLocalModel ||
      localLocalModelName !== api.localModelName ||
      localLocalApiUrl !== api.localApiUrl;

    setHasUnsavedChanges(hasChanges);
  }, [localProvider, localModel, localRequestDelay, localParallelWorkers, api, localUseLocalModel, localLocalModelName, localLocalApiUrl]);

  // Check local model connection
  useEffect(() => {
    if (!localLocalApiUrl) {
      setLocalModelConnected(false);
      return;
    }

    const checkConnection = async () => {
      const connected = await checkLocalModelConnection(localLocalApiUrl);
      setLocalModelConnected(connected);
    };
    checkConnection();
  }, [localLocalApiUrl]);

  // Fetch local models when toggle is enabled
  useEffect(() => {
    const loadLocalModels = async () => {
      if (!localUseLocalModel || !localLocalApiUrl) {
        setLocalModels([]);
        return;
      }

      setIsLoadingLocalModels(true);
      try {
        const fetchedModels = await fetchLocalModels(localLocalApiUrl);
        setLocalModels(fetchedModels);
      } catch (error) {
        console.error('Error loading local models:', error);
        const message = error instanceof Error ? error.message : 'Failed to load local models';
        toast.error(message);
        setLocalModels([]);
      } finally {
        setIsLoadingLocalModels(false);
      }
    };

    loadLocalModels();
  }, [localUseLocalModel, localLocalApiUrl]);

  // Fetch models when local provider changes
  useEffect(() => {
    const loadModels = async () => {
      if (!localProvider) {
        setModels([]);
        return;
      }

      setIsLoadingModels(true);
      try {
        let fetchedModels: ModelInfo[] = [];

        switch (localProvider) {
          // case 'openai':
          //   fetchedModels = await fetchOpenAIModels(localApiKeys.openai);
          //   break;
          case 'gemini':
            fetchedModels = await fetchGeminiModels(localApiKeys.gemini);
            break;
          case 'openrouter':
            fetchedModels = await fetchOpenRouterModels(localApiKeys.openrouter);
            break;
          default:
            fetchedModels = [];
        }

        setModels(fetchedModels);
      } catch (error) {
        console.error('Error loading models:', error);
        toast.error('Failed to load models');
        setModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [localProvider, localApiKeys]);

  const handleSave = () => {
    // Save all changes to context (except processing mode which is applied immediately)
    api.setSelectedProvider(localProvider);
    api.setSelectedModel(localModel);
    api.setRequestDelay(localRequestDelay);
    api.setParallelWorkers(localParallelWorkers);
    api.setUseLocalModel(localUseLocalModel);
    api.setLocalModelName(localLocalModelName);
    api.setLocalApiUrl(localLocalApiUrl);

    toast.success('Settings saved successfully!');

    // Show success indicator
    setShowSavedIndicator(true);

    // Hide indicator after 2 seconds
    setTimeout(() => setShowSavedIndicator(false), 2000);
  };

  const handleCancel = () => {
    // Reset local state to match context (except processing mode which is applied immediately)
    setLocalProvider(api.selectedProvider);
    setLocalModel(api.selectedModel);
    setLocalApiKeys(api.apiKeys);
    setLocalRequestDelay(api.requestDelay);
    setLocalParallelWorkers(api.parallelWorkers);
    setLocalUseLocalModel(api.useLocalModel);
    setLocalLocalModelName(api.localModelName);
    setLocalLocalApiUrl(api.localApiUrl);
    toast.info('Changes discarded');
  };

  const handleTestConnection = async () => {
    if (!localLocalApiUrl) {
      toast.error('Please enter your local AI server URL first.');
      return;
    }
    const connected = await checkLocalModelConnection(localLocalApiUrl);
    if (connected) {
      toast.success('Local AI connection successful!');
    } else {
      toast.error('Could not connect to the local AI server. Make sure it is running and the URL is correct.');
    }
    setLocalModelConnected(connected);
  };

  return (
    <div className="space-y-4">
      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
            Unsaved Changes
          </Badge>
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            You have unsaved changes. Click "Save Settings" to apply them.
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
            Settings saved successfully!
          </span>
        </div>
      )}

      {/* Use Local Model Toggle */}
      <div className="flex items-center justify-between p-4 bg-accent rounded-md">
        <div>
          <Label htmlFor="useLocalModel" className="text-base font-medium">
            Use Local Model
          </Label>
          <p className="text-xs text-gray-400 mt-1">
            Use a local AI model instead of cloud API
          </p>
        </div>
        <Switch
          id="useLocalModel"
          checked={localUseLocalModel}
          onCheckedChange={(checked) => {
            setLocalUseLocalModel(checked);
            api.setUseLocalModel(checked);
            toast.success(checked ? 'Switched to local model' : 'Switched to API model');
          }}
        />
      </div>

      {/* Connection Status */}
      {localUseLocalModel && (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${localModelConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">
            {!localLocalApiUrl
              ? 'Enter a local AI server URL'
              : localModelConnected
                ? 'Local AI connected'
                : 'Local AI not reachable'}
          </span>
          <Button variant="ghost" size="sm" onClick={handleTestConnection}>
            Test
          </Button>
        </div>
      )}

      {/* Conditional UI: Local Model or API Model */}
      {localUseLocalModel ? (
        // Local Model UI
        <div className="space-y-4">
          <div>
            <Label htmlFor="localApiUrl" className="text-base font-medium mb-2">Local AI Server URL</Label>
            <Input
              type="url"
              id="localApiUrl"
              value={localLocalApiUrl}
              onChange={(e) => setLocalLocalApiUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
            />
            <p className="text-xs text-gray-400 mt-1">
              e.g. <span className="font-mono">http://localhost:1234</span> — the <span className="font-mono">/v1</span> suffix is added automatically. Only vision-capable models (LM Studio shows a "vision" capability) can describe images.
            </p>
          </div>

          <div>
            <Label htmlFor="localModel" className="text-base font-medium mb-2">Local Model</Label>
            <ModelSelector
              models={localModels}
              value={localLocalModelName}
              onValueChange={setLocalLocalModelName}
              isLoading={isLoadingLocalModels}
              disabled={!localModelConnected || !localLocalApiUrl}
              placeholder={
                !localLocalApiUrl
                  ? "Enter a local AI server URL"
                  : !localModelConnected
                    ? "Local AI not connected"
                    : localModels.length === 0 && !isLoadingLocalModels
                      ? "No local models found"
                      : "Select a model"
              }
            />
          </div>

          {/* Processing Mode Toggle for Local Model */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label htmlFor="processingModeLocal" className="text-base font-medium">
                  Batch Processing Mode
                </Label>
                <p className="text-xs text-gray-400 mt-1">
                  {localProcessingMode === 'sequential' 
                    ? 'Sequential: Process images one at a time'
                    : 'Parallel: Process multiple images simultaneously'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Seq</span>
                <Switch
                  id="processingModeLocal"
                  checked={localProcessingMode === 'parallel'}
                  onCheckedChange={(checked) => {
                    const newMode = checked ? 'parallel' : 'sequential';
                    setLocalProcessingMode(newMode);
                    api.setProcessingMode(newMode);
                    toast.success(`Processing mode changed to ${newMode}`);
                  }}
                />
                <span className="text-sm text-gray-500">Par</span>
              </div>
            </div>

            {/* Parallel Workers Slider (only show in parallel mode) */}
            {localProcessingMode === 'parallel' && (
              <div className="mt-3 border-muted b">
                <Label htmlFor="parallelWorkersLocal" className="text-sm font-medium mb-2">
                  Parallel Workers: {localParallelWorkers}
                </Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">1</span>
                  <input
                    type="range"
                    id="parallelWorkersLocal"
                    min={1}
                    max={5}
                    value={localParallelWorkers}
                    onChange={(e) => setLocalParallelWorkers(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-400">5</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // API Model UI
        <div className="space-y-4">
          <div>
            <Label htmlFor="provider" className="text-base font-medium mb-2">Provider</Label>
            <Select onValueChange={(val) => setLocalProvider(val as Provider)} value={localProvider || undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent className="ring-foreground/10">
                {providers.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="model" className="text-base font-medium mb-2">AI Model</Label>
            <ModelSelector
              models={models}
              value={localModel}
              onValueChange={setLocalModel}
              isLoading={isLoadingModels}
              disabled={!localProvider}
              placeholder={
                !localProvider
                  ? "Select a provider first"
                  : models.length === 0 && !isLoadingModels
                    ? "No models available"
                    : "Select a model"
              }
            />
          </div>
          <div className="pt-5 border-t flex flex-row justify-between gap-2">
            <Label htmlFor="requestDelay" className="text-base font-medium mb-2">
              Request Delay (seconds)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                id="requestDelay"
                value={localRequestDelay / 1000}
                placeholder="1"
                min={0}
                max={10}
                step={0.5}
                onChange={(e) => {
                  const seconds = parseFloat(e.target.value || '0');
                  setLocalRequestDelay(seconds * 1000);
                }}
                className="w-10"
              />
            </div>
          </div>

          {/* Processing Mode Toggle */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="processingMode" className="text-base font-medium">
                  Batch Processing Mode
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  {localProcessingMode === 'sequential' 
                    ? 'Sequential: Process images one at a time (safe for free APIs)'
                    : 'Parallel: Process multiple images simultaneously (faster for paid APIs)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sequential</span>
                <Switch
                  id="processingMode"
                  checked={localProcessingMode === 'parallel'}
                  onCheckedChange={(checked) => {
                    const newMode = checked ? 'parallel' : 'sequential';
                    setLocalProcessingMode(newMode);
                    api.setProcessingMode(newMode); // Apply immediately
                    toast.success(`Processing mode changed to ${newMode}`);
                  }}
                />
                <span className="text-sm text-gray-500">Parallel</span>
              </div>
            </div>

            {/* Parallel Workers Slider (only show in parallel mode) */}
            {localProcessingMode === 'parallel' && (
              <div className="mt-3 ">
                <Label htmlFor="parallelWorkers" className="text-sm font-medium mt-2 mb-2">
                  Parallel Workers: {localParallelWorkers}
                </Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">1</span>
                  <input
                    type="range"
                    id="parallelWorkers"
                    min={1}
                    max={5}
                    value={localParallelWorkers}
                    onChange={(e) => setLocalParallelWorkers(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-400">5</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save and Cancel buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          className="flex-1"
        >
          Save Settings
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
}

export default ApiSettings;
