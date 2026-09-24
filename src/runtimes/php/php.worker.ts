/// <reference lib="webworker" />
import { loadPHPRuntime, PHP, setPhpIniEntries } from "@php-wasm/universal";
import { getPHPLoaderModule } from "@php-wasm/web-8-4";
import { lockDownGlobals } from "../core/lockdown";
import { serveRuntime } from "../core/serve";
import { createPhpHandler, PHP_INI } from "./handler";

const handler = createPhpHandler(async () => {
  const php = new PHP(await loadPHPRuntime(await getPHPLoaderModule()));
  await setPhpIniEntries(php, PHP_INI);
  // The wasm binary is fetched during load; user code never gets network access.
  lockDownGlobals(self);
  return php;
});

serveRuntime(handler, { target: self });
