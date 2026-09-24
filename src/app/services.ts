import { FIXTURE_LIST } from "../../fixtures/challenges";
import type { Settings } from "@/domain/settings";
import { openRepository } from "@/persistence/indexeddb-repository";
import type { ChallengeRepository } from "@/persistence/repository";
import { SecretStore, SettingsStore } from "@/persistence/settings-store";
import { implementedLanguages, runtimeLoaders } from "@/runtimes/registry";
import { AttemptStore } from "@/services/attempt-store";
import { ExecutionService } from "@/services/execution/execution-service";
import { createChallengeSource } from "@/services/generation/factory";
import { LocalClaudeStatusStore } from "@/services/generation/local-claude";
import type { ChallengeSource } from "@/services/generation/source";
import { loadPublishedPortfolio, type PublishedPortfolio } from "@/services/portfolio/published";

/** Everything the UI needs, created once at startup and provided via context. */
export interface AppServices {
  attempts: AttemptStore;
  execution: ExecutionService;
  settingsStore: SettingsStore;
  secrets: SecretStore;
  storageWarning?: string;
  loadPublished: () => Promise<PublishedPortfolio>;
  createSource: (settings: Settings) => ChallengeSource;
  /** Local Claude (dev builds only); "unsupported" in the public build. */
  localClaude: LocalClaudeStatusStore;
}

export interface ServiceOverrides {
  repository?: ChallengeRepository;
  execution?: ExecutionService;
  settingsStore?: SettingsStore;
  secrets?: SecretStore;
  loadPublished?: () => Promise<PublishedPortfolio>;
  createSource?: (settings: Settings) => ChallengeSource;
  localClaude?: LocalClaudeStatusStore;
}

export async function createAppServices(overrides: ServiceOverrides = {}): Promise<AppServices> {
  const opened = overrides.repository
    ? { repository: overrides.repository }
    : await openRepository();
  const attempts = new AttemptStore(opened.repository);
  await attempts.load();
  const execution = overrides.execution ?? new ExecutionService(runtimeLoaders());
  const secrets = overrides.secrets ?? new SecretStore();
  const localClaude = overrides.localClaude ?? new LocalClaudeStatusStore();

  const createSource =
    overrides.createSource ??
    ((settings: Settings) =>
      createChallengeSource(settings, {
        samples: FIXTURE_LIST,
        getApiKey: () => secrets.getApiKey(),
        availableLanguages: implementedLanguages,
        knownChallenges: () =>
          Promise.resolve(
            [...attempts.getSnapshot().attempts]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map(({ challenge }) => ({
                id: challenge.id,
                title: challenge.title,
                fingerprint: challenge.fingerprint,
                language: challenge.language,
                category: challenge.category,
                archetype: challenge.archetype,
              })),
          ),
        prepareRuntime: (language) => execution.prepare(language),
        localClaude: () => localClaude.getSnapshot(),
      }));

  return {
    attempts,
    execution,
    settingsStore: overrides.settingsStore ?? new SettingsStore(),
    secrets,
    ...(opened.warning ? { storageWarning: opened.warning } : {}),
    loadPublished: overrides.loadPublished ?? (() => loadPublishedPortfolio()),
    createSource,
    localClaude,
  };
}
