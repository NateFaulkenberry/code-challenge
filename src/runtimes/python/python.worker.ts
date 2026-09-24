/// <reference lib="webworker" />
import { loadPyodide, version } from "pyodide";
import { assetUrl } from "@/utils/asset-url";
import { lockDownGlobals } from "../core/lockdown";
import { serveRuntime } from "../core/serve";
import { createPythonHandler } from "./handler";

const handler = createPythonHandler(async () => {
  const pyodide = await loadPyodide({ indexURL: assetUrl(`runtimes/python/${version}/`) });
  // Pyodide needs fetch while loading; user code never gets it.
  lockDownGlobals(self);
  return pyodide;
});

serveRuntime(handler, { target: self });
