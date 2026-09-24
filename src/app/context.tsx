import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Attempt } from "@/domain/attempt";
import type { LanguageId } from "@/domain/languages";
import type { Settings } from "@/domain/settings";
import type { AttemptSnapshot } from "@/services/attempt-store";
import type { RuntimeState } from "@/services/execution/execution-service";
import type { LocalClaudeAvailability } from "@/services/generation/local-claude";
import type { ChallengeSource } from "@/services/generation/source";
import type { PublishedPortfolio } from "@/services/portfolio/published";
import type { AppServices } from "./services";
import { applyTheme } from "./theme";

const ServicesContext = createContext<AppServices | null>(null);
const SettingsContext = createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
} | null>(null);
const PublishedContext = createContext<PublishedPortfolio>({ status: "loading" });

export function AppProviders({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(() => services.settingsStore.load());
  const [published, setPublished] = useState<PublishedPortfolio>({ status: "loading" });

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        services.settingsStore.save(next);
        return next;
      });
    },
    [services],
  );

  // Local development only: ask the dev server whether local Claude is set up.
  useEffect(() => {
    void services.localClaude.refresh();
  }, [services]);

  useEffect(() => {
    let cancelled = false;
    void services.loadPublished().then((result) => {
      if (!cancelled) setPublished(result);
    });
    return () => {
      cancelled = true;
    };
  }, [services]);

  useTheme(settings.theme);

  const settingsValue = useMemo(() => ({ settings, update }), [settings, update]);
  return (
    <ServicesContext.Provider value={services}>
      <SettingsContext.Provider value={settingsValue}>
        <PublishedContext.Provider value={published}>{children}</PublishedContext.Provider>
      </SettingsContext.Provider>
    </ServicesContext.Provider>
  );
}

function useTheme(theme: Settings["theme"]): void {
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices must be used inside <AppProviders>");
  return services;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside <AppProviders>");
  return value;
}

export function useAttempts(): AttemptSnapshot {
  const { attempts } = useServices();
  return useSyncExternalStore(attempts.subscribe, attempts.getSnapshot);
}

export function usePublishedPortfolio(): PublishedPortfolio {
  return useContext(PublishedContext);
}

export interface LibraryEntry {
  attempt: Attempt;
  origin: "local" | "published";
}

/** Local history plus published portfolio entries; local copies win on id collisions. */
export function useLibrary(): { entries: LibraryEntry[]; loading: boolean } {
  const local = useAttempts();
  const published = usePublishedPortfolio();
  return useMemo(() => {
    const localIds = new Set(local.attempts.map((a) => a.id));
    const publishedEntries =
      published.status === "ready"
        ? published.attempts
            .filter((a) => !localIds.has(a.id))
            .map((attempt) => ({ attempt, origin: "published" as const }))
        : [];
    return {
      entries: [
        ...local.attempts.map((attempt) => ({ attempt, origin: "local" as const })),
        ...publishedEntries,
      ],
      loading: local.status === "loading" || published.status === "loading",
    };
  }, [local, published]);
}

export function useRuntimeState(language: LanguageId): RuntimeState {
  const { execution } = useServices();
  const subscribe = useCallback(
    (onChange: () => void) => execution.subscribe((changed) => changed === language && onChange()),
    [execution, language],
  );
  return useSyncExternalStore(subscribe, () => execution.state(language));
}

export function useLocalClaude(): LocalClaudeAvailability {
  const { localClaude } = useServices();
  return useSyncExternalStore(localClaude.subscribe, localClaude.getSnapshot);
}

export function useChallengeSource(): ChallengeSource {
  const { createSource } = useServices();
  const { settings } = useSettings();
  // Re-create when local Claude's status changes so labels and readiness stay current.
  const localClaude = useLocalClaude();
  // createSource reads the local Claude store; the snapshot is a deliberate dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createSource(settings), [createSource, settings, localClaude]);
}
