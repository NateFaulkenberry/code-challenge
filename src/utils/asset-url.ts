/**
 * Resolves a path inside the deployed site, honouring the configured base
 * (e.g. `/repo/` on GitHub Pages project sites). Never hard-code `/`.
 */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}
