import { describe, expect, it } from "vitest";
import {
  normalizeTestResults,
  PROTOCOL_PREFIX,
  ProtocolStream,
  scanProtocolOutput,
} from "./test-protocol";

const line = (nonce: string, value: object) =>
  `${PROTOCOL_PREFIX}${nonce}:${JSON.stringify(value)}`;

describe("test result protocol", () => {
  it("extracts results and strips protocol lines from output", () => {
    const text = [
      "hello",
      line("n1", { id: "a", status: "pass" }),
      "world",
      line("n1", { id: "b", status: "fail", message: "x" }),
    ].join("\n");
    const scan = scanProtocolOutput(text, "n1");
    expect(scan.output).toBe("hello\nworld");
    expect(scan.results).toEqual([
      { id: "a", status: "pass" },
      { id: "b", status: "fail", message: "x" },
    ]);
  });

  it("ignores lines with the wrong nonce (user output can't forge results)", () => {
    const scan = scanProtocolOutput(line("forged", { id: "a", status: "pass" }), "real");
    expect(scan.results).toEqual([]);
  });

  it("ignores malformed payloads", () => {
    expect(scanProtocolOutput(`${PROTOCOL_PREFIX}n:{oops`, "n").results).toEqual([]);
    expect(scanProtocolOutput(line("n", { id: "a", status: "great" }), "n").results).toEqual([]);
  });

  it("handles protocol markers appearing after unterminated user output", () => {
    const scan = scanProtocolOutput(`partial${line("n", { id: "a", status: "pass" })}`, "n");
    expect(scan.output).toBe("partial");
    expect(scan.results).toHaveLength(1);
  });

  it("streams across arbitrary chunk boundaries", () => {
    const text: string[] = [];
    const results: string[] = [];
    const stream = new ProtocolStream(
      "n",
      (t) => text.push(t),
      (r) => results.push(r.id),
    );
    const full = `out1\n${line("n", { id: "a", status: "pass" })}\nout2`;
    for (const char of full) stream.push(char);
    stream.flush();
    expect(text.join("")).toBe("out1\nout2");
    expect(results).toEqual(["a"]);
  });

  it("normalizes to one result per case in request order", () => {
    const results = normalizeTestResults(
      ["a", "b", "c"],
      [
        { id: "c", status: "pass" },
        { id: "a", status: "fail" },
      ],
      {
        timedOut: true,
        runningId: "b",
      },
    );
    expect(results.map((r) => r.status)).toEqual(["fail", "timeout", "pass"]);
  });

  it("attaches the crash message to cases that never ran", () => {
    const [result] = normalizeTestResults(["a"], [], {
      timedOut: false,
      crashMessage: "compile error",
    });
    expect(result).toEqual({ id: "a", status: "not-run", message: "compile error" });
  });
});
