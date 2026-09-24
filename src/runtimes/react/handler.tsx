import * as TestingLibrary from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import * as ReactJsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import type { HandlerContext, RawOutcome, RuntimeHandler } from "../core/types";
import { describeError, loadSolutionModule, runJsTests, type JsRunnerConfig } from "../js/runner";

/**
 * Only these modules are importable. They are the exact instances the
 * harness uses, so hooks and Testing Library share one React.
 */
const modules = {
  react: () => React,
  "react/jsx-runtime": () => ReactJsxRuntime,
  "react-dom": () => ReactDOM,
  "react-dom/client": () => ReactDOMClient,
  "@testing-library/react": () => TestingLibrary,
  "@testing-library/user-event": () => ({ default: userEvent, __esModule: true, ...userEvent }),
};

const config: JsRunnerConfig = {
  solutionFile: "solution.tsx",
  jsx: true,
  modules,
  // The iframe may share the page's thread; stop runaway loops quickly.
  loopBudgetMs: 1_000,
  beforeEach: () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  },
  afterEach: () => {
    TestingLibrary.cleanup();
    document.body.querySelectorAll(":scope > div:not(#preview)").forEach((node) => node.remove());
  },
};

class PreviewBoundary extends React.Component<
  { onError: (error: unknown) => void; children: React.ReactNode },
  { error: unknown }
> {
  override state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div role="alert" className="ccl-preview-error">
          <strong>The component threw while rendering</strong>
          <pre>{describeError(this.state.error, config.solutionFile)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function createReactHandler(previewElement: () => HTMLElement): RuntimeHandler {
  let root: ReactDOMClient.Root | undefined;

  const clearPreview = () => {
    root?.unmount();
    root = undefined;
    previewElement().replaceChildren();
  };

  async function renderPreview(source: string, ctx: HandlerContext): Promise<RawOutcome> {
    clearPreview();
    const loaded = loadSolutionModule(source, config, ctx);
    if (!loaded.ok) return loaded.outcome;
    const Component = loaded.exports.default;
    if (typeof Component !== "function" && !(typeof Component === "object" && Component !== null)) {
      ctx.stderr("The solution must `export default` a React component.\n");
      return {
        status: "runtime-error",
        exitCode: 1,
        diagnostics: [],
        message: "No default-exported component.",
      };
    }
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    let renderError: unknown;
    root = ReactDOMClient.createRoot(previewElement(), {
      onUncaughtError: (error) => {
        renderError ??= error;
      },
    });
    ReactDOM.flushSync(() => {
      root?.render(
        <PreviewBoundary onError={(error) => (renderError ??= error)}>
          {React.createElement(Component as React.ComponentType)}
        </PreviewBoundary>,
      );
    });
    // Let effects run once so immediate effect errors surface.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (renderError !== undefined) {
      ctx.stderr(`${describeError(renderError, config.solutionFile)}\n`);
      return {
        status: "runtime-error",
        exitCode: 1,
        diagnostics: [],
        message: "The component threw while rendering.",
      };
    }
    return { status: "success", exitCode: 0, diagnostics: [] };
  }

  return {
    init: () => Promise.resolve(),
    execute: (request, ctx) => renderPreview(request.source, ctx),
    runTests: async (request, ctx) => {
      // The preview lives in the same document; clear it so Testing Library queries only see test renders.
      clearPreview();
      return runJsTests(request, config, ctx);
    },
  };
}
