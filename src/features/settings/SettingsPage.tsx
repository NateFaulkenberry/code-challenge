import { useId, useState } from "react";
import { useServices, useSettings } from "@/app/context";
import { Button } from "@/components/Button";
import { Field, fieldStyles, SelectField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { ANTHROPIC_MODELS, type ProviderId, type Settings } from "@/domain/settings";
import { maskSecret } from "@/persistence/settings-store";
import { LOCAL_CLAUDE_LABEL, LOCAL_CLAUDE_SUPPORTED } from "@/services/generation/local-claude";
import { LocalClaudePanel } from "./LocalClaudePanel";
import { DataSection } from "./DataSection";
import styles from "./SettingsPage.module.css";

const PROVIDER_OPTIONS: { value: ProviderId; label: string }[] = [
  { value: "fixtures", label: "Sample challenges (offline, no key)" },
  { value: "anthropic", label: "Anthropic — your own API key" },
  { value: "proxy", label: "Custom proxy endpoint" },
  // Only offered when running the app locally; absent from the public build.
  ...(LOCAL_CLAUDE_SUPPORTED
    ? [
        {
          value: "claude-local" as const,
          label: `${LOCAL_CLAUDE_LABEL} (your Claude subscription)`,
        },
      ]
    : []),
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { secrets } = useServices();
  const [keyDraft, setKeyDraft] = useState("");
  const [storedKey, setStoredKey] = useState(() => secrets.getApiKey());
  const keyId = useId();
  const proxyId = useId();
  const fontId = useId();
  const timeoutId = useId();

  const saveKey = () => {
    secrets.setApiKey(keyDraft);
    setStoredKey(secrets.getApiKey());
    setKeyDraft("");
    // Changing a setting re-creates the generation source with the new key.
    update({});
  };

  const clearKey = () => {
    secrets.clearApiKey();
    setStoredKey(undefined);
    update({});
  };

  return (
    <div className={styles.page}>
      <h1>Settings</h1>

      <section className={styles.section} aria-labelledby="generation-heading">
        <h2 id="generation-heading">Challenge generation</h2>
        <SelectField
          label="Provider"
          value={settings.provider}
          options={PROVIDER_OPTIONS}
          onChange={(provider) => update({ provider })}
        />

        {settings.provider === "anthropic" && (
          <>
            <SelectField
              label="Model"
              value={settings.anthropicModel}
              onChange={(anthropicModel) => update({ anthropicModel })}
              options={ANTHROPIC_MODELS.map((m) => ({ value: m.id, label: m.label }))}
            />
            <Notice tone="warning" title="Your key stays in this browser — but it is exposed to it">
              The key is stored in this browser&apos;s local storage and sent directly from your
              browser to api.anthropic.com. Anyone with access to this browser profile, or any
              script running on this site, could read it. Use a key with a spending limit, and clear
              it on shared machines. It is never included in exports.
            </Notice>
            <Field
              label="Anthropic API key"
              htmlFor={keyId}
              hint={storedKey ? `Stored key: ${maskSecret(storedKey)}` : "No key stored."}
            >
              <div className={styles.inline}>
                <input
                  id={keyId}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className={fieldStyles.control}
                  placeholder={storedKey ? "Enter a new key to replace it" : "sk-ant-…"}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                />
                <Button variant="primary" onClick={saveKey} disabled={!keyDraft.trim()}>
                  Save key
                </Button>
                {storedKey && (
                  <Button variant="danger" onClick={clearKey}>
                    Remove
                  </Button>
                )}
              </div>
            </Field>
          </>
        )}

        {settings.provider === "proxy" && (
          <Field
            label="Proxy URL"
            htmlFor={proxyId}
            hint="POST endpoint that accepts { system, messages, jsonSchema } and returns { text, model }."
          >
            <input
              id={proxyId}
              type="url"
              className={fieldStyles.control}
              placeholder="https://example.com/api/generate"
              defaultValue={settings.proxyUrl}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value === "" || URL.canParse(value)) update({ proxyUrl: value });
              }}
            />
          </Field>
        )}

        {LOCAL_CLAUDE_SUPPORTED && settings.provider === "claude-local" && <LocalClaudePanel />}

        {settings.provider === "fixtures" && (
          <p className={styles.description}>
            Sample mode uses a small bundled set of challenges so the app works without an API key.
            Generated challenges require a provider.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="editor-heading">
        <h2 id="editor-heading">Editor</h2>
        <div className={styles.grid}>
          <SelectField<Settings["theme"]>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "system", label: "Match system" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <Field label="Font size" htmlFor={fontId}>
            <input
              id={fontId}
              type="number"
              min={10}
              max={24}
              className={fieldStyles.control}
              value={settings.editorFontSize}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 10 && value <= 24) update({ editorFontSize: value });
              }}
            />
          </Field>
          <SelectField
            label="Tab size"
            value={String(settings.tabSize)}
            onChange={(value) => update({ tabSize: Number(value) as Settings["tabSize"] })}
            options={[
              { value: "2", label: "2 spaces" },
              { value: "4", label: "4 spaces" },
              { value: "8", label: "8 spaces" },
            ]}
          />
        </div>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => update({ autoSave: e.target.checked })}
          />
          Auto-save solutions while typing
        </label>
      </section>

      <section className={styles.section} aria-labelledby="execution-heading">
        <h2 id="execution-heading">Execution</h2>
        <Field
          label="Time limit (seconds)"
          htmlFor={timeoutId}
          hint="Runs exceeding this are stopped and the runtime is restarted."
        >
          <input
            id={timeoutId}
            type="number"
            min={1}
            max={60}
            className={`${fieldStyles.control} ${styles.narrow}`}
            value={settings.executionTimeoutMs / 1000}
            onChange={(e) => {
              const seconds = Number(e.target.value);
              if (seconds >= 1 && seconds <= 60)
                update({ executionTimeoutMs: Math.round(seconds * 1000) });
            }}
          />
        </Field>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={settings.showDiagnostics}
            onChange={(e) => update({ showDiagnostics: e.target.checked })}
          />
          Show advanced runtime diagnostics
        </label>
      </section>

      <DataSection />
    </div>
  );
}
