import { describe, expect, it } from "vitest";
import { createInProcessRuntime } from "../../../tests/helpers/in-process-runtime";
import type { LanguageId } from "@/domain/languages";
import type { LanguageRuntime } from "@/runtimes/core/types";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { UnavailableRuntime } from "@/runtimes/unavailable";
import { ExecutionService, type RuntimeState } from "./execution-service";

function loaders(overrides: Partial<Record<LanguageId, () => Promise<LanguageRuntime>>>) {
  const unavailable = (id: LanguageId) => () =>
    Promise.resolve<LanguageRuntime>(new UnavailableRuntime(id, "n/a"));
  return {
    typescript: unavailable("typescript"),
    react: unavailable("react"),
    python: unavailable("python"),
    php: unavailable("php"),
    c: unavailable("c"),
    cpp: unavailable("cpp"),
    java: unavailable("java"),
    ...overrides,
  };
}

describe("ExecutionService", () => {
  it("loads lazily, once, and reports state transitions", async () => {
    let loads = 0;
    const service = new ExecutionService(
      loaders({
        typescript: () => {
          loads++;
          return Promise.resolve(createInProcessRuntime("typescript", typescriptHandler).runtime);
        },
      }),
    );
    const seen: RuntimeState["phase"][] = [];
    service.subscribe((_lang, state) => seen.push(state.phase));
    expect(service.state("typescript")).toBe(service.state("typescript")); // stable idle snapshot
    await Promise.all([service.prepare("typescript"), service.prepare("typescript")]);
    await service.prepare("typescript");
    expect(loads).toBe(1);
    expect(service.state("typescript").phase).toBe("ready");
    expect(seen).toContain("loading");
    service.disposeAll();
  });

  it("reports unsupported runtimes without throwing", async () => {
    const service = new ExecutionService(loaders({}));
    await service.prepare("java");
    expect(service.state("java")).toEqual({ phase: "unsupported", reason: "n/a" });
  });

  it("reports initialization failures as an error state", async () => {
    const { runtime } = createInProcessRuntime("python", {
      ...typescriptHandler,
      init: () => Promise.reject(new Error("wasm download failed")),
    });
    const service = new ExecutionService(loaders({ python: () => Promise.resolve(runtime) }));
    await service.prepare("python");
    expect(service.state("python")).toEqual({ phase: "error", message: "wasm download failed" });
  });
});
