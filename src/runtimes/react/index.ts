import type { ExecutionResult, TestRunResult } from "@/domain/execution";
import { assetUrl } from "@/utils/asset-url";
import { createIframeEndpoint } from "../core/iframe-endpoint";
import { SandboxRuntime } from "../core/sandbox-host";
import type {
  ExecutionRequest,
  InitProgress,
  LanguageRuntime,
  RuntimeSupport,
  TestRunRequest,
} from "../core/types";

export interface PreviewCapable {
  /** Moves the sandbox into `element` so users can interact with the rendered component. */
  attachPreview(element: HTMLElement, options: { theme: "light" | "dark" }): () => void;
}

export function isPreviewCapable(
  runtime: LanguageRuntime,
): runtime is LanguageRuntime & PreviewCapable {
  return "attachPreview" in runtime;
}

/**
 * React runtime: a SandboxRuntime whose endpoint is a sandboxed iframe.
 * Moving an iframe in the DOM reloads it, so attaching/detaching the preview
 * restarts the sandbox inside the new parent instead of reparenting.
 */
export class ReactRuntime implements LanguageRuntime, PreviewCapable {
  readonly language = "react" as const;
  readonly kind = "browser" as const;
  private container: HTMLElement | null = null;
  private theme: "light" | "dark" = "light";
  private offscreen: HTMLElement | null = null;
  private readonly inner: SandboxRuntime;

  constructor() {
    this.inner = new SandboxRuntime({
      language: "react",
      initTimeoutMs: 30_000,
      createEndpoint: () =>
        createIframeEndpoint({
          parent: this.container ?? this.offscreenHost(),
          src: `${assetUrl("sandbox.html")}#theme=${this.theme}`,
          title: "Component preview (sandboxed)",
        }),
    });
  }

  isSupported(): RuntimeSupport {
    return typeof document === "undefined"
      ? { supported: false, reason: "React challenges need a browser document." }
      : { supported: true };
  }

  initialize(onProgress?: (progress: InitProgress) => void): Promise<void> {
    return this.inner.initialize(onProgress);
  }

  execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.inner.execute(request);
  }

  runTests(request: TestRunRequest): Promise<TestRunResult> {
    return this.inner.runTests(request);
  }

  attachPreview(element: HTMLElement, options: { theme: "light" | "dark" }): () => void {
    this.container = element;
    this.theme = options.theme;
    this.inner.restart();
    return () => {
      if (this.container !== element) return;
      this.container = null;
      this.inner.restart();
    };
  }

  dispose(): void {
    this.inner.dispose();
    this.offscreen?.remove();
    this.offscreen = null;
  }

  /** Hidden host used when no preview pane is mounted (e.g. validating a generated challenge). */
  private offscreenHost(): HTMLElement {
    if (!this.offscreen) {
      this.offscreen = document.createElement("div");
      this.offscreen.setAttribute("aria-hidden", "true");
      this.offscreen.style.cssText =
        "position:fixed;left:-10000px;top:0;width:800px;height:600px;overflow:hidden;";
      document.body.append(this.offscreen);
    }
    return this.offscreen;
  }
}

export function createReactRuntime(): ReactRuntime {
  return new ReactRuntime();
}
