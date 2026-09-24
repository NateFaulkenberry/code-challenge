import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLocalClaudeHandler, LOCAL_CLAUDE_PATH, refuseUnlessLocal } from "./http.ts";
import { ClaudeError, type ClaudeProvider, type ClaudeStatus } from "./types.ts";

const SECRET = "sk-ant-oat01-FAKE-TOKEN-THAT-MUST-NOT-LEAK";

function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
): IncomingMessage {
  const stream = Readable.from(
    body === undefined ? [] : [Buffer.from(body)],
  ) as unknown as IncomingMessage;
  stream.method = method;
  stream.url = path;
  stream.headers = { host: "localhost:5173", ...headers };
  return stream;
}

interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  json: () => Record<string, unknown>;
}

function response(): { res: ServerResponse; done: Promise<CapturedResponse>; close: () => void } {
  const emitter = new EventEmitter();
  const headers: Record<string, string> = {};
  let resolve!: (value: CapturedResponse) => void;
  const done = new Promise<CapturedResponse>((r) => (resolve = r));
  const res = Object.assign(emitter, {
    statusCode: 200,
    writableEnded: false,
    destroyed: false,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    getHeaderNames() {
      return Object.keys(headers);
    },
    removeHeader(name: string) {
      Reflect.deleteProperty(headers, name.toLowerCase());
    },
    end(body: string) {
      res.writableEnded = true;
      resolve({
        status: res.statusCode,
        headers,
        body,
        json: () => JSON.parse(body) as Record<string, unknown>,
      });
    },
  });
  return { res: res as unknown as ServerResponse, done, close: () => emitter.emit("close") };
}

function provider(overrides: Partial<ClaudeProvider> = {}): ClaudeProvider {
  const status: ClaudeStatus = {
    provider: "subscription",
    state: "ready",
    authentication: "claude-subscription",
    subscription: "Claude Max",
    message: "ok",
  };
  return {
    kind: "subscription",
    status: () => Promise.resolve(status),
    isAvailable: () => Promise.resolve(true),
    run: () => Promise.resolve({ text: "hello", model: "claude-opus-5-5", durationMs: 5 }),
    ...overrides,
  };
}

async function call(p: ClaudeProvider, req: IncomingMessage, env: Record<string, string> = {}) {
  const { res, done } = response();
  // Simulate Vite's global CORS middleware, which runs first on the dev server.
  res.setHeader("Access-Control-Allow-Origin", "*");
  const state = { passed: false };
  createLocalClaudeHandler(p, { env })(req, res, () => (state.passed = true));
  if (state.passed) return "next" as const;
  return done;
}

const json = { "content-type": "application/json" };
const body = JSON.stringify({ system: "s", messages: [{ role: "user", content: "hi" }] });

describe("local Claude HTTP handler", () => {
  it("ignores unrelated paths", async () => {
    expect(await call(provider(), request("GET", "/index.html"))).toBe("next");
    expect(await call(provider(), request("GET", "/__local/claudex"))).toBe("next");
  });

  it("serves status without secrets or CORS headers", async () => {
    const result = await call(provider(), request("GET", `${LOCAL_CLAUDE_PATH}/status`));
    if (result === "next") throw new Error("unexpected");
    expect(result.status).toBe(200);
    expect(result.json()).toMatchObject({ state: "ready", subscription: "Claude Max" });
    expect(result.headers).not.toHaveProperty("access-control-allow-origin");
    expect(result.headers["cache-control"]).toBe("no-store");
  });

  it("generates text for a same-origin JSON request", async () => {
    let received: unknown;
    const p = provider({
      run: (r) => ((received = r), Promise.resolve({ text: "done", model: "m", durationMs: 1 })),
    });
    const result = await call(
      p,
      request(
        "POST",
        `${LOCAL_CLAUDE_PATH}/generate`,
        { ...json, origin: "http://localhost:5173", "sec-fetch-site": "same-origin" },
        body,
      ),
    );
    if (result === "next") throw new Error("unexpected");
    expect(result.status).toBe(200);
    expect(result.json()).toEqual({ text: "done", model: "m" });
    expect(received).toEqual({ system: "s", messages: [{ role: "user", content: "hi" }] });
  });

  it.each([
    ["another website (CSRF)", { origin: "https://evil.example" }],
    ["a cross-site fetch", { "sec-fetch-site": "cross-site" }],
    ["the sandboxed code runners (opaque origin)", { origin: "null" }],
    ["a DNS-rebinding host", { host: "attacker.example:5173" }],
    ["a LAN address", { host: "192.168.1.20:5173" }],
  ])("refuses requests from %s", async (_label, headers) => {
    let ran = false;
    const p = provider({
      run: () => ((ran = true), Promise.resolve({ text: "", model: "", durationMs: 0 })),
    });
    const result = await call(
      p,
      request("POST", `${LOCAL_CLAUDE_PATH}/generate`, { ...json, ...headers }, body),
    );
    if (result === "next") throw new Error("unexpected");
    expect(result.status).toBe(403);
    expect(ran).toBe(false);
  });

  it("accepts IPv6 and 127.0.0.1 loopback hosts", () => {
    expect(refuseUnlessLocal(request("GET", "/", { host: "127.0.0.1:5173" }))).toBeUndefined();
    expect(refuseUnlessLocal(request("GET", "/", { host: "[::1]:5173" }))).toBeUndefined();
  });

  it("requires JSON (so cross-origin form posts can't reach it) and a valid body", async () => {
    const plain = await call(
      provider(),
      request("POST", `${LOCAL_CLAUDE_PATH}/generate`, { "content-type": "text/plain" }, body),
    );
    expect(plain !== "next" && plain.status).toBe(415);
    const invalid = await call(
      provider(),
      request("POST", `${LOCAL_CLAUDE_PATH}/generate`, json, "{not json"),
    );
    expect(invalid !== "next" && invalid.status).toBe(400);
    const wrongShape = await call(
      provider(),
      request("POST", `${LOCAL_CLAUDE_PATH}/generate`, json, JSON.stringify({ messages: [] })),
    );
    expect(wrongShape !== "next" && wrongShape.status).toBe(400);
  });

  it("removes the dev server's global CORS grant from every response (regression)", async () => {
    const ok = await call(provider(), request("GET", `${LOCAL_CLAUDE_PATH}/status`));
    const refused = await call(
      provider(),
      request("GET", `${LOCAL_CLAUDE_PATH}/status`, { origin: "https://evil.example" }),
    );
    for (const result of [ok, refused]) {
      if (result === "next") throw new Error("unexpected");
      expect(Object.keys(result.headers).filter((h) => h.startsWith("access-control-"))).toEqual(
        [],
      );
    }
  });

  it("rejects other methods, including CORS preflights", async () => {
    const options = await call(provider(), request("OPTIONS", `${LOCAL_CLAUDE_PATH}/generate`));
    expect(options !== "next" && options.status).toBe(405);
    const get = await call(provider(), request("GET", `${LOCAL_CLAUDE_PATH}/generate`));
    expect(get !== "next" && get.status).toBe(405);
  });

  it.each([
    ["unauthenticated", 401],
    ["api-key-in-use", 409],
    ["rate-limited", 429],
    ["timeout", 504],
    ["disabled", 503],
    ["request-failed", 502],
  ] as const)("maps %s errors to HTTP %i", async (code, status) => {
    const p = provider({ run: () => Promise.reject(new ClaudeError(code, `failure ${code}`)) });
    const result = await call(p, request("POST", `${LOCAL_CLAUDE_PATH}/generate`, json, body));
    if (result === "next") throw new Error("unexpected");
    expect(result.status).toBe(status);
    expect(result.json()).toEqual({ error: { code, message: `failure ${code}` } });
  });

  it("never returns secrets in error responses", async () => {
    const p = provider({ run: () => Promise.reject(new Error(`boom ${SECRET}`)) });
    const result = await call(p, request("POST", `${LOCAL_CLAUDE_PATH}/generate`, json, body), {
      CLAUDE_CODE_OAUTH_TOKEN: SECRET,
    });
    if (result === "next") throw new Error("unexpected");
    expect(result.body).not.toContain(SECRET);
  });

  it("cancels the Claude request when the browser disconnects", async () => {
    let signal: AbortSignal | undefined;
    const p = provider({
      run: (_r, s) =>
        new Promise((_, reject) => {
          signal = s;
          s?.addEventListener("abort", () => reject(new ClaudeError("cancelled", "cancelled")));
        }),
    });
    const { res, close } = response();
    createLocalClaudeHandler(p)(
      request("POST", `${LOCAL_CLAUDE_PATH}/generate`, json, body),
      res,
      () => undefined,
    );
    await new Promise((r) => setTimeout(r, 10));
    close();
    expect(signal?.aborted).toBe(true);
  });
});
