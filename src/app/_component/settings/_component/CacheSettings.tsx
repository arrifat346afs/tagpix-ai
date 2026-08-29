import { useEffect, useState } from "react";
import { getCacheInfo, clearCacheDirectory, CacheDirectory } from "@/app/lib/tauri/tauri-commands";
import { Button } from "@/components/ui/button";
import { Trash2, HardDrive, Loader2, Monitor, Apple, Circle } from "lucide-react";

const OSIcon = ({ osType }: { osType: string }) => {
  switch (osType) {
    case "windows":
      return <Monitor className="h-5 w-5" />;
    case "macos":
      return <Apple className="h-5 w-5" />;
    case "linux":
      return <Circle className="h-5 w-5" />;
    default:
      return <HardDrive className="h-5 w-5" />;
  }
};

const formatSize = (bytes: number): string => {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(2)} GB`;
  } else if (bytes >= mb) {
    return `${(bytes / mb).toFixed(2)} MB`;
  } else if (bytes >= kb) {
    return `${(bytes / kb).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

const CacheSettings = () => {
  const [caches, setCaches] = useState<CacheDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const loadCaches = async () => {
    setLoading(true);
    try {
      const info = await getCacheInfo();
      setCaches(info);
    } catch (error) {
      console.error("Failed to load cache info:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaches();
  }, []);

  const handleClearCache = async (path: string) => {
    setClearingId(path);
    try {
      await clearCacheDirectory(path);
      await loadCaches();
    } catch (error) {
      console.error("Failed to clear cache:", error);
    } finally {
      setClearingId(null);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      for (const cache of caches) {
        await clearCacheDirectory(cache.path);
      }
      await loadCaches();
    } catch (error) {
      console.error("Failed to clear all caches:", error);
    } finally {
      setClearingAll(false);
    }
  };

  const totalSize = caches.reduce((acc, cache) => acc + cache.size_bytes, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Cache Management</h3>
        <p className="text-sm text-muted-foreground">
          View and clear cache directories to free up disk space.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : caches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No cache directories found.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Total Cache Size</span>
            </div>
            <span className="text-lg font-semibold">{formatSize(totalSize)}</span>
          </div>

          <div className="space-y-3">
            {caches.map((cache) => (
              <div
                key={cache.path}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <OSIcon osType={cache.os_type} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{cache.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {cache.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium">
                    {formatSize(cache.size_bytes)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClearCache(cache.path)}
                    disabled={clearingId === cache.path}
                  >
                    {clearingId === cache.path ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleClearAll}
            disabled={clearingAll || totalSize === 0}
          >
            {clearingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing all caches...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Caches
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};

export default CacheSettings;