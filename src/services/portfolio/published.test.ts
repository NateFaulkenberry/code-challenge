import { describe, expect, it, vi } from "vitest";
import { at, makeChallenge, passedAttempt, T0 } from "../../../tests/helpers/factories";
import { createAttempt } from "@/domain/attempt";
import { createBackup } from "@/domain/export-format";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { loadPublishedPortfolio } from "./published";

const respond = (status: number, body = "") =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));

describe("loadPublishedPortfolio", () => {
  it("treats a missing file as an empty portfolio", async () => {
    expect(await loadPublishedPortfolio(respond(404), "/portfolio.json")).toEqual({
      status: "ready",
      attempts: [],
    });
  });

  it("returns only passed attempts", async () => {
    const file = createBackup(
      [passedAttempt(makeChallenge(), at(1)), createAttempt(makeChallenge({ id: "wip" }), T0)],
      DEFAULT_SETTINGS,
      T0,
    );
    const result = await loadPublishedPortfolio(
      respond(200, JSON.stringify(file)),
      "/portfolio.json",
    );
    expect(result.status === "ready" && result.attempts.map((a) => a.status)).toEqual(["passed"]);
  });

  it("reports malformed files", async () => {
    const result = await loadPublishedPortfolio(respond(200, "{bad"), "/portfolio.json");
    expect(result).toMatchObject({ status: "error" });
  });
});
