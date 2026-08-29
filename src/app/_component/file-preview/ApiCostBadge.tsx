import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { apiCostTracker } from "@/app/lib/cost/apiCostTracker";
import { formatCost, getModelPriceInfo, formatModelPrice } from "@/app/lib/cost/apiCost";
import { refreshModelPricing } from "@/app/lib/models/modelFetcher";
import { useConfigStore } from "@/store/configStore";
import { cn } from "@/lib/utils";

type ApiCostBadgeProps = {
  className?: string;
};

/**
 * Displays the API cost for the current session and the pricing of the
 * currently selected model (read from persisted settings at startup).
 * All cost computation and state management live here; parent components
 * only render this badge.
 */
export const ApiCostBadge = ({ className }: ApiCostBadgeProps) => {
  const snapshot = useSyncExternalStore(
    apiCostTracker.subscribe,
    apiCostTracker.getSnapshot,
    apiCostTracker.getSnapshot
  );

  const { selectedProvider, selectedModel, apiKeys, useLocalModel, localModelName, localApiUrl } =
    useConfigStore((state) => state.api);

  const [isLoadingPricing, setIsLoadingPricing] = useState(false);

  const provider = useLocalModel ? 'local' : selectedProvider;
  const model = useLocalModel ? localModelName : selectedModel;
  const apiKey = provider && provider !== 'local' ? apiKeys[provider as keyof typeof apiKeys] : undefined;

  // Fetch the selected provider's model pricing on startup (and when the
  // selection changes) so the badge can show the exact price of the
  // previously selected model before any request is made.
  const requestedKey = `${provider}:${apiKey ?? ''}:${useLocalModel}:${localApiUrl ?? ''}`;
  const lastRequestedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!provider || lastRequestedRef.current === requestedKey) return;
    lastRequestedRef.current = requestedKey;
    setIsLoadingPricing(true);
    refreshModelPricing(provider, apiKey, useLocalModel, localApiUrl)
      .catch(() => {})
      .finally(() => setIsLoadingPricing(false));
  }, [provider, apiKey, requestedKey, useLocalModel, localApiUrl]);

  // Recompute once the pricing refresh settles — refreshModelPricing populates
  // the metadata cache as a side effect the memo deps can't observe.
  const modelInfo = useMemo(
    () => getModelPriceInfo(provider, model),
    [provider, model, isLoadingPricing]
  );

  const modelLabel = modelInfo ? formatModelPrice(modelInfo) : null;
  const isFreeModel = modelInfo?.free === true;

  const sessionLabel =
    snapshot.requestCount > 0
      ? formatCost({ totalCost: snapshot.totalCost, free: snapshot.free })
      : null;

  if (!provider && snapshot.requestCount === 0) {
    return null;
  }

  const title = snapshot.requestCount
    ? `${snapshot.requestCount} API request${snapshot.requestCount === 1 ? "" : "s"} this session`
    : "Per 1M tokens (prompt / completion)";

  return (
    <Badge
      variant="ghost"
      className={cn(
        "pointer-events-none gap-1 bg-background/70 backdrop-blur-sm text-xs px-2.5 py-1 h-auto shadow-sm",
        isFreeModel && "text-emerald-600 dark:text-emerald-400",
        className
      )}
      title={title}
    >
      {modelInfo ? (
        <span>
          {modelInfo.label}:{" "}
          <span className="font-semibold">
            {isLoadingPricing && modelLabel === "Unknown" ? "Loading…" : modelLabel}
          </span>
        </span>
      ) : null}
      {modelInfo && sessionLabel ? <span className="text-muted-foreground">·</span> : null}
      {sessionLabel ? <span>Session: {sessionLabel}</span> : null}
    </Badge>
  );
};