import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { redactSecrets } from "./safe-env.ts";
import { ClaudeError, type ClaudeErrorCode, type ClaudeProvider } from "./types.ts";

export const LOCAL_CLAUDE_PATH = "/__local/claude";
const MAX_BODY_BYTES = 1_000_000;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const GenerateBodySchema = z.object({
  system: z.string().max(200_000),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(400_000) }))
    .min(1)
    .max(20),
});

const STATUS_FOR: Record<ClaudeErrorCode, number> = {
  "bad-request": 400,
  unauthenticated: 401,
  "api-key-in-use": 409,
  "rate-limited": 429,
  cancelled: 499,
  "request-failed": 502,
  disabled: 503,
  "sdk-unavailable": 503,
  timeout: 504,
};

type Next = (error?: unknown) => void;

/**
 * Serves the local Claude endpoints inside the Vite dev server:
 *
 *   GET  /__local/claude/status    → ClaudeStatus (no secrets, no email)
 *   POST /__local/claude/generate  → { text, model }   body: { system, messages }
 *
 * Only same-origin requests to a loopback host are accepted: other websites
 * open in the browser (CSRF), DNS-rebinding hosts and the sandboxed code
 * runners (opaque "null" origin) are refused. No CORS headers are ever sent.
 */
export function createLocalClaudeHandler(
  provider: ClaudeProvider,
  options: { env?: Record<string, string | undefined>; log?: (line: string) => void } = {},
) {
  const env = options.env ?? {};
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    if (path !== LOCAL_CLAUDE_PATH && !path.startsWith(`${LOCAL_CLAUDE_PATH}/`)) {
      next();
      return;
    }
    void handle(req, res, path).catch((error: unknown) => {
      send(res, 500, {
        error: { code: "internal", message: redactSecrets(String(error), env).slice(0, 300) },
      });
    });
  };

  async function handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const refusal = refuseUnlessLocal(req);
    if (refusal) {
      send(res, 403, { error: { code: "forbidden", message: refusal } });
      return;
    }
    if (path === `${LOCAL_CLAUDE_PATH}/status` && req.method === "GET") {
      send(res, 200, await provider.status());
      return;
    }
    if (path === `${LOCAL_CLAUDE_PATH}/generate` && req.method === "POST") {
      if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
        send(res, 415, { error: { code: "bad-request", message: "Expected application/json." } });
        return;
      }
      const parsed = GenerateBodySchema.safeParse(await readJson(req));
      if (!parsed.success) {
        send(res, 400, {
          error: { code: "bad-request", message: "Expected { system, messages[] }." },
        });
        return;
      }
      // Cancel the Claude request if the browser goes away.
      const controller = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const result = await provider.run(parsed.data, controller.signal);
        send(res, 200, { text: result.text, model: result.model });
      } catch (error) {
        const code: ClaudeErrorCode = error instanceof ClaudeError ? error.code : "request-failed";
        const message = redactSecrets(
          error instanceof Error ? error.message : String(error),
          env,
        ).slice(0, 1_000);
        options.log?.(`local Claude request failed (${code}): ${message}`);
        if (!res.writableEnded && !res.destroyed)
          send(res, STATUS_FOR[code], { error: { code, message } });
      }
      return;
    }
    send(res, 405, {
      error: { code: "method-not-allowed", message: "Unsupported method or path." },
    });
  }
}

/** Returns a reason to refuse, or undefined for a same-origin loopback request. */
export function refuseUnlessLocal(req: IncomingMessage): string | undefined {
  const host = req.headers.host ?? "";
  const hostname = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : (host.split(":")[0] ?? "");
  if (!LOCAL_HOSTNAMES.has(hostname.toLowerCase()))
    return "Local Claude only answers requests addressed to localhost.";
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`)
    return "Cross-origin requests are not allowed.";
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none")
    return "Cross-site requests are not allowed.";
  return undefined;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The dev server enables CORS globally (the React sandbox needs it), and its
 * middleware runs before this one. Local Claude responses must never carry a
 * cross-origin grant, so those headers are removed here.
 */
function stripCors(res: ServerResponse): void {
  for (const name of res.getHeaderNames()) {
    if (name.toLowerCase().startsWith("access-control-")) res.removeHeader(name);
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  stripCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}
