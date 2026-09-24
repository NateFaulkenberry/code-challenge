import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// CodeMirror measures layout through Range rects, which jsdom doesn't implement.
if (typeof Range !== "undefined" && !("getClientRects" in Range.prototype)) {
  Object.assign(Range.prototype, {
    getClientRects: () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }),
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
    }),
  });
}
// jsdom's <dialog> lacks showModal/close in some versions (typed as always present).
const dialogProto = (
  globalThis as unknown as { HTMLDialogElement?: { prototype: Record<string, unknown> } }
).HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== "function") {
  dialogProto.showModal = function showModal(this: HTMLElement) {
    this.setAttribute("open", "");
  };
  dialogProto.close = function close(this: HTMLElement) {
    this.removeAttribute("open");
  };
}
