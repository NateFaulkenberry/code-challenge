import { lockDownGlobals } from "@/runtimes/core/lockdown";
import { serveRuntime } from "@/runtimes/core/serve";
import { createReactHandler } from "@/runtimes/react/handler";
import "./sandbox.css";

/**
 * Entry point of the sandboxed iframe (opaque origin). It hosts the React
 * runtime and never talks to anything but its parent over a private port.
 */
const theme = new URLSearchParams(location.hash.slice(1)).get("theme");
document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";

// Challenge tests deliberately use real timers (debounce, async data), so
// React's "not wrapped in act(...)" warning is expected noise here. User
// console output is captured separately and is unaffected.
const reactConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act(")) return;
  reactConsoleError(...args);
};

const preview = document.getElementById("preview");
if (!preview) throw new Error("Sandbox is missing #preview");

serveRuntime(
  createReactHandler(() => preview),
  { target: window, acceptSource: (event) => event.source === window.parent },
);
lockDownGlobals(window);
window.parent.postMessage("ccl:sandbox-ready", "*");
