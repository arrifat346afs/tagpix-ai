import { useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { apiCostTracker } from "@/app/lib/apiCostTracker";
import { formatCost } from "@/app/lib/apiCost";
import { cn } from "@/lib/utils";

type ApiCostBadgeProps = {
  className?: string;
};

/**
 * Displays the total API cost accumulated for the current session.
 * All cost computation and state management live here; parent components
 * only render this badge.
 */
export const ApiCostBadge = ({ className }: ApiCostBadgeProps) => {
  const snapshot = useSyncExternalStore(
    apiCostTracker.subscribe,
    apiCostTracker.getSnapshot,
    apiCostTracker.getSnapshot
  );

  if (snapshot.requestCount === 0) {
    return null;
  }

  const label = formatCost({ totalCost: snapshot.totalCost, free: snapshot.free });

  return (
    <Badge
      variant="ghost"
      className={cn(
        "pointer-events-none gap-1 bg-background/70 backdrop-blur-sm text-xs px-2.5 py-1 h-auto shadow-sm",
        label === "Free" && "text-emerald-600 dark:text-emerald-400",
        className
      )}
      title={`${snapshot.requestCount} API request${snapshot.requestCount === 1 ? "" : "s"} this session`}
    >
      API: {label}
    </Badge>
  );
};