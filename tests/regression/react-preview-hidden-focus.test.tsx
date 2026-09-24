/**
 * Bug: while the Tests tab was active, the React preview container used the
 * `hidden` attribute (display: none). Elements inside a non-rendered iframe
 * cannot receive focus, so Testing Library's userEvent.type() typed into
 * nothing and every interaction test failed in real browsers (jsdom has no
 * such rule, so runtime unit tests passed).
 * Fix: the inactive preview is moved offscreen but stays rendered.
 * The browser-level check lives in tests/e2e/react.spec.ts.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/app/context";
import { createAppServices } from "@/app/services";
import { PreviewPane } from "@/features/workspace/PreviewPane";
import { MemoryRepository } from "@/persistence/memory-repository";

describe("regression: hidden preview stays focusable", () => {
  it("never uses display:none / the hidden attribute for an inactive preview", async () => {
    const services = await createAppServices({
      repository: new MemoryRepository(),
      loadPublished: () => Promise.resolve({ status: "ready", attempts: [] }),
    });
    const { container } = render(
      <AppProviders services={services}>
        <PreviewPane language="react" hidden />
      </AppProviders>,
    );
    const pane = container.firstElementChild as HTMLElement;
    expect(pane.hidden).toBe(false);
    expect(pane.getAttribute("aria-hidden")).toBe("true");
    expect(pane.className).toMatch(/offscreen/);
  });
});
