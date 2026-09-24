import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { maskSecret, SecretStore, SettingsStore, type KeyValueStorage } from "./settings-store";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("SettingsStore", () => {
  it("round-trips settings", () => {
    const store = new SettingsStore(memoryStorage());
    store.save({ ...DEFAULT_SETTINGS, editorFontSize: 16 });
    expect(store.load().editorFontSize).toBe(16);
  });

  it("recovers from corrupt JSON", () => {
    const storage = memoryStorage();
    storage.setItem("ccl:settings", "{nope");
    expect(new SettingsStore(storage).load()).toEqual(DEFAULT_SETTINGS);
  });

  it("works without storage (private mode)", () => {
    const store = new SettingsStore(undefined);
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    expect(() => store.save(DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe("SecretStore", () => {
  it("stores the key separately from settings", () => {
    const storage = memoryStorage();
    new SecretStore(storage).setApiKey("  sk-ant-123456789  ");
    new SettingsStore(storage).save(DEFAULT_SETTINGS);
    expect(storage.data.get("ccl:settings")).not.toContain("sk-ant");
    expect(new SecretStore(storage).getApiKey()).toBe("sk-ant-123456789");
  });

  it("clears the key when set to blank", () => {
    const store = new SecretStore(memoryStorage());
    store.setApiKey("sk-ant-x");
    store.setApiKey("   ");
    expect(store.hasApiKey()).toBe(false);
  });

  it("masks secrets for display", () => {
    expect(maskSecret("sk-ant-api03-abcdefghijkl")).toBe("sk-ant-…ijkl");
    expect(maskSecret("short")).toBe("••••");
  });
});
