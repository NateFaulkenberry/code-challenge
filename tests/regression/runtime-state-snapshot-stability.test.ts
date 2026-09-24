/**
 * Bug: ExecutionService.state() returned `{ phase: "idle" }` as a fresh object
 * on every call. useSyncExternalStore requires referentially stable
 * snapshots and re-rendered forever.
 */
import { describe, expect, it } from "vitest";
import { runtimeLoaders } from "@/runtimes/registry";
import { ExecutionService } from "@/services/execution/execution-service";

describe("regression: runtime state snapshots are stable", () => {
  it("returns the same object for an idle language across calls", () => {
    const service = new ExecutionService(runtimeLoaders());
    expect(service.state("python")).toBe(service.state("python"));
  });
});
