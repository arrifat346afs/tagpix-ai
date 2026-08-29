/**
 * Module-level handle to the currently active metadata-generation run.
 *
 * Lets the Cancel button abort in-flight AI HTTP requests immediately,
 * instead of only stopping the loop between files.
 */

let activeController: AbortController | null = null;

/** Starts a new generation run, cancelling any straggler from a previous one. */
export function beginGeneration(): AbortSignal {
  if (activeController) {
    activeController.abort();
  }
  activeController = new AbortController();
  return activeController.signal;
}

/** Marks the current run as finished (no more requests to abort). */
export function endGeneration(): void {
  activeController = null;
}

/**
 * Aborts every in-flight request of the active run.
 * Returns true when a run was actually aborted.
 */
export function cancelGeneration(): boolean {
  if (!activeController) return false;
  activeController.abort();
  activeController = null;
  return true;
}
