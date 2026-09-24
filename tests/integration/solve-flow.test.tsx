/**
 * Integration: generate → validate → display → edit → test → submit → pass →
 * persist, through the real UI, router, stores and TypeScript runtime
 * handler (served in-process instead of in a Worker).
 */
import { EditorView } from "@codemirror/view";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../../fixtures/challenges";
import { createInProcessRuntime } from "../helpers/in-process-runtime";
import { ScriptedProvider } from "../helpers/scripted-provider";
import { AppProviders } from "@/app/context";
import { createRouter } from "@/app/router";
import { createAppServices } from "@/app/services";
import { UnsavedChangesProvider } from "@/app/unsaved-changes";
import { ChallengeDraftSchema } from "@/domain/challenge";
import { DEFAULT_SETTINGS } from "@/domain/settings";
import { MemoryRepository } from "@/persistence/memory-repository";
import { SettingsStore, SecretStore, type KeyValueStorage } from "@/persistence/settings-store";
import { runtimeLoaders } from "@/runtimes/registry";
import { typescriptHandler } from "@/runtimes/typescript/handler";
import { ExecutionService } from "@/services/execution/execution-service";
import { LlmChallengeSource } from "@/services/generation/llm-source";

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

async function renderApp() {
  const repository = new MemoryRepository();
  const execution = new ExecutionService({
    ...runtimeLoaders(),
    typescript: () =>
      Promise.resolve(createInProcessRuntime("typescript", typescriptHandler).runtime),
  });
  // random() = 0 resolves category/archetype to the first affinity entries; the scripted "model" honours them.
  const draft = {
    ...ChallengeDraftSchema.parse(FIXTURES["typescript-beginner"]),
    category: "algorithms",
    archetype: "implementation",
  };
  const provider = new ScriptedProvider([JSON.stringify(draft)]);
  const settingsStore = new SettingsStore(memoryStorage());
  settingsStore.save({ ...DEFAULT_SETTINGS, provider: "anthropic", autoSave: false });
  const services = await createAppServices({
    repository,
    execution,
    settingsStore,
    secrets: new SecretStore(memoryStorage()),
    loadPublished: () => Promise.resolve({ status: "ready", attempts: [] }),
    createSource: () =>
      new LlmChallengeSource({
        provider,
        availableLanguages: () => ["typescript"],
        knownChallenges: () => Promise.resolve([]),
        prepareRuntime: (language) => execution.prepare(language),
        validationTimeoutMs: 10_000,
        random: () => 0,
      }),
  });
  window.location.hash = "#/";
  render(
    <AppProviders services={services}>
      <UnsavedChangesProvider>
        <RouterProvider router={createRouter()} />
      </UnsavedChangesProvider>
    </AppProviders>,
  );
  return { repository, services, provider };
}

describe("integration: generate → solve → persist", () => {
  it("completes a challenge only after a full passing submission", async () => {
    const user = userEvent.setup();
    const { repository, services } = await renderApp();

    // Generate (targeted request; the pipeline validates by running the reference).
    await user.click(screen.getByRole("button", { name: "New challenge" }));
    const dialog = await screen.findByRole("dialog", { name: "New challenge" });
    await user.selectOptions(within(dialog).getByLabelText("Language"), "typescript");
    await user.selectOptions(within(dialog).getByLabelText("Difficulty"), "beginner");
    await user.click(within(dialog).getByRole("button", { name: "Generate challenge" }));

    // Display
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Normalize Article Tags" },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("TypeScript ready")).toBeInTheDocument(), {
      timeout: 10_000,
    });
    const [stored] = (await repository.list()).attempts;
    expect(stored?.status).toBe("generated");
    expect(stored?.challenge.provenance).toMatchObject({
      source: "llm",
      generatorVersion: "challenge-generator-v1",
    });

    // Visible tests fail on the starter
    await user.click(screen.getByRole("button", { name: /^Test/ }));
    expect(
      await screen.findByText(/Visible tests · \d\/3 passed/, undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect((await repository.list()).attempts[0]?.status).toBe("in-progress");

    // Edit through the real editor (CodeMirror's public API; keystroke simulation isn't meaningful in jsdom).
    const attempt = services.attempts.get(stored!.id)!;
    const editorElement = document.querySelector<HTMLElement>(".cm-editor");
    const view = editorElement && EditorView.findFromDOM(editorElement);
    expect(view).toBeTruthy();
    act(() => {
      view!.dispatch({
        changes: {
          from: 0,
          to: view!.state.doc.length,
          insert: attempt.challenge.referenceSolution,
        },
      });
    });
    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Test/ }));
    expect(
      await screen.findByText(/Visible tests · 3\/3 passed/, undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect((await repository.list()).attempts[0]?.status).toBe("in-progress"); // visible-only never completes

    // Submit runs hidden tests too and completes the challenge
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText("All tests passed — challenge complete", undefined, {
        timeout: 10_000,
      }),
    ).toBeInTheDocument();
    const completed = (await repository.list()).attempts[0]!;
    expect(completed).toMatchObject({
      status: "passed",
      passedSolution: attempt.challenge.referenceSolution,
    });
    expect(completed.completedAt).toBeDefined();
    expect(completed.lastTestRun?.includedHidden).toBe(true);
  });
});
