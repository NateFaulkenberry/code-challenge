/// <reference lib="webworker" />
import { lockDownGlobals } from "../core/lockdown";
import { serveRuntime } from "../core/serve";
import { createClangHandler } from "./handler";
import { loadSelfHostedToolchain } from "./toolchain";

// The toolchain keeps fetching lazily during its first compile (warm-up in init),
// so globals are locked down only after initialization completes.
const handler = createClangHandler("cpp", loadSelfHostedToolchain);
serveRuntime(
  {
    ...handler,
    init: async (ctx) => {
      await handler.init(ctx);
      lockDownGlobals(self);
    },
  },
  { target: self },
);
