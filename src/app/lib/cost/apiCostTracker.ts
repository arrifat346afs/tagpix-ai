/**
 * API Cost Tracker
 * In-memory session-wide accumulator for API request costs.
 * Resets automatically on restart (nothing is persisted).
 */

import type { AIUsage } from '../ai/api-client';
import { computeCost } from './apiCost';

export type CostSnapshot = {
  totalCost: number;
  requestCount: number;
  free: boolean;
};

type Listener = () => void;

class ApiCostTracker {
  private totalCost = 0;
  private requestCount = 0;
  private free = true;
  private listeners = new Set<Listener>();
  private snapshot: CostSnapshot = { totalCost: 0, requestCount: 0, free: true };

  /** Records a single API request (billed or not) into the session total. */
  recordCall = (provider?: string, model?: string, usage?: AIUsage): void => {
    const { totalCost, free } = computeCost(provider, model, usage);
    this.totalCost += totalCost;
    this.requestCount += 1;
    this.free = this.free && free;
    this.snapshot = { totalCost: this.totalCost, requestCount: this.requestCount, free: this.free };
    this.emit();
  };

  reset = (): void => {
    this.totalCost = 0;
    this.requestCount = 0;
    this.free = true;
    this.snapshot = { totalCost: 0, requestCount: 0, free: true };
    this.emit();
  };

  getSnapshot = (): CostSnapshot => {
    return this.snapshot;
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit = (): void => {
    this.listeners.forEach((listener) => listener());
  };
}

export const apiCostTracker = new ApiCostTracker();