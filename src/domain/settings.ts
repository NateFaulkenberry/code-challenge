import { z } from "zod";

export const PROVIDER_IDS = ["anthropic", "proxy", "fixtures", "claude-local"] as const;
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (recommended)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (faster, cheaper)" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1 (most capable)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fastest)" },
] as const;

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/**
 * Non-secret preferences. The API key is deliberately NOT part of this schema,
 * so it can never leak into an export.
 */
export const SettingsSchema = z.object({
  provider: ProviderIdSchema,
  anthropicModel: z.string().min(1).max(100),
  proxyUrl: z.union([z.url(), z.literal("")]),
  theme: z.enum(["system", "light", "dark"]),
  editorFontSize: z.number().int().min(10).max(24),
  tabSize: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  autoSave: z.boolean(),
  executionTimeoutMs: z.number().int().min(1_000).max(60_000),
  showDiagnostics: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  provider: "fixtures",
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  proxyUrl: "",
  theme: "system",
  editorFontSize: 14,
  tabSize: 2,
  autoSave: true,
  executionTimeoutMs: 10_000,
  showDiagnostics: false,
};

/** Merge stored values over defaults, dropping anything invalid field by field. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, schema] of Object.entries(SettingsSchema.shape)) {
    const value = (raw as Record<string, unknown>)[key];
    if (value !== undefined && schema.safeParse(value).success) result[key] = value;
  }
  return SettingsSchema.parse(result);
}
