import { DEFAULT_SETTINGS, parseSettings, type Settings } from "@/domain/settings";

const SETTINGS_KEY = "ccl:settings";
const API_KEY_KEY = "ccl:anthropic-api-key";

/** Minimal Storage subset, so tests can inject a fake and private modes can degrade. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export class SettingsStore {
  constructor(private readonly storage: KeyValueStorage | undefined = safeStorage()) {}

  load(): Settings {
    const raw = this.storage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    try {
      return parseSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  save(settings: Settings): void {
    this.storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

/**
 * The BYOK API key is kept apart from settings so it can never be exported or
 * logged with them. It is only ever read to build a provider request.
 */
export class SecretStore {
  constructor(private readonly storage: KeyValueStorage | undefined = safeStorage()) {}

  getApiKey(): string | undefined {
    return this.storage?.getItem(API_KEY_KEY) ?? undefined;
  }

  setApiKey(key: string): void {
    const trimmed = key.trim();
    if (trimmed) this.storage?.setItem(API_KEY_KEY, trimmed);
    else this.clearApiKey();
  }

  clearApiKey(): void {
    this.storage?.removeItem(API_KEY_KEY);
  }

  hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }
}

export function maskSecret(secret: string): string {
  return secret.length <= 8 ? "••••" : `${secret.slice(0, 7)}…${secret.slice(-4)}`;
}
