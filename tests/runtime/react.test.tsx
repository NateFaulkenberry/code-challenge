import { describe, expect, it } from "vitest";
import reactIntermediate from "../../fixtures/challenges/react-intermediate";
import { createReactHandler } from "@/runtimes/react/handler";
import { recordingContext } from "../helpers/handler-context";
import { describeRuntimeContract } from "./contract";

// jsdom stands in for the sandboxed iframe's document.
function previewElement(): HTMLElement {
  let el = document.getElementById("preview");
  if (!el) {
    el = document.createElement("div");
    el.id = "preview";
    document.body.append(el);
  }
  return el;
}

const handler = createReactHandler(previewElement);

describeRuntimeContract(
  "React",
  handler,
  {
    hello: `console.log("hello");\nexport default function App() { return <p>hi</p>; }`,
    stderr: `console.error("oops");\nexport default function App() { return null; }`,
    compileError: `export default function App() { return <div>; }`,
    runtimeError: `export default function App(): JSX.Element { throw new Error("render failed"); }`,
  },
  [reactIntermediate],
);

describe("React runtime specifics", () => {
  it("renders the default export into the preview", async () => {
    const outcome = await handler.execute(
      {
        source: `import { useState } from "react";\nexport default function App() { const [n] = useState(41); return <button>{n + 1}</button>; }`,
      },
      recordingContext(),
    );
    expect(outcome.status).toBe("success");
    expect(previewElement().textContent).toBe("42");
  });

  it("rejects a module without a default component", async () => {
    const ctx = recordingContext();
    const outcome = await handler.execute({ source: `export const x = 1;` }, ctx);
    expect(outcome.status).toBe("runtime-error");
    expect(ctx.stderrText).toContain("export default");
  });

  it("clears the preview before tests so queries only see test renders", async () => {
    await handler.execute(
      { source: `export default () => <p>preview text</p>;` },
      recordingContext(),
    );
    const ctx = recordingContext();
    await handler.runTests(
      {
        source: `export default () => <p>component</p>;`,
        prelude: `import { render, screen } from "@testing-library/react";\nimport C from "./solution";`,
        cases: [
          {
            id: "only-test-dom",
            code: `render(<C />);\nexpect(screen.queryByText("preview text")).toBeNull();\nexpect(screen.getByText("component")).toBeInTheDocument();`,
          },
        ],
      },
      ctx,
    );
    expect(ctx.tests[0]).toMatchObject({ status: "pass" });
  });

  it("stops an infinite loop in a component instead of hanging", async () => {
    const ctx = recordingContext();
    const outcome = await handler.execute(
      { source: `export default function App() { while (true) {} return null; }` },
      ctx,
    );
    expect(outcome.status).toBe("runtime-error");
    expect(ctx.stderrText).toContain("infinite loop");
  });

  it("does not allow importing modules outside the allow-list", async () => {
    const ctx = recordingContext();
    await handler.execute(
      { source: `import axios from "axios";\nconsole.log(axios);\nexport default () => null;` },
      ctx,
    );
    expect(ctx.stderrText).toContain('Cannot import "axios"');
  });
});
