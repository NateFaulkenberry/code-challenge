/// <reference lib="webworker" />
import { lockDownGlobals } from "../core/lockdown";
import { serveRuntime } from "../core/serve";
import { typescriptHandler } from "./handler";

serveRuntime(typescriptHandler, { target: self });
lockDownGlobals(self);
