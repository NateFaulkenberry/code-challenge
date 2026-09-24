import type { Attempt } from "@/domain/attempt";
import { parseExportFile } from "@/domain/export-format";
import { assetUrl } from "@/utils/asset-url";

export const PUBLISHED_PORTFOLIO_PATH = "portfolio/portfolio.json";

export type PublishedPortfolio =
  | { status: "loading" }
  | { status: "ready"; attempts: Attempt[]; exportedAt?: string }
  | { status: "error"; message: string };

/**
 * Loads the owner's published portfolio (a committed portfolio export) from
 * the deployed site. A missing file simply means nothing is published yet.
 */
export async function loadPublishedPortfolio(
  fetchImpl: typeof fetch = fetch,
  url = assetUrl(PUBLISHED_PORTFOLIO_PATH),
): Promise<PublishedPortfolio> {
  let response: Response;
  try {
    response = await fetchImpl(url, { cache: "no-cache" });
  } catch {
    return { status: "ready", attempts: [] };
  }
  if (response.status === 404) return { status: "ready", attempts: [] };
  if (!response.ok)
    return {
      status: "error",
      message: `Could not load the published portfolio (HTTP ${response.status}).`,
    };
  const parsed = parseExportFile(await response.text());
  if (!parsed.ok) return { status: "error", message: parsed.error };
  return {
    status: "ready",
    attempts: parsed.file.attempts.filter((a) => a.status === "passed"),
    exportedAt: parsed.file.exportedAt,
  };
}
