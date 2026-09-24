import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAttempts, useRuntimeState, useServices, useSettings } from "@/app/context";
import { recordTestRun, revealReference, updateSolution, type Attempt } from "@/domain/attempt";
import { compactTestRun, type ExecutionResult, type TestRunResult } from "@/domain/execution";

export type Activity = "idle" | "running" | "testing" | "submitting";

export interface WorkspaceState {
  attempt: Attempt | undefined;
  loading: boolean;
  source: string;
  dirty: boolean;
  activity: Activity;
  saving: boolean;
  lastSavedAt: string | undefined;
  execution: ExecutionResult | undefined;
  testRun: TestRunResult | undefined;
  /** Set when the latest submit completed the challenge. */
  justPassed: boolean;
  error: string | undefined;
}

const AUTOSAVE_DELAY_MS = 1_000;

/**
 * Workspace controller: bridges editor state, the language runtime and
 * persistence. Domain rules (lifecycle transitions) live in domain/attempt;
 * this hook only sequences them.
 */
export function useWorkspace(attemptId: string) {
  const { attempts, execution: executionService } = useServices();
  const snapshot = useAttempts();
  const { settings } = useSettings();
  const attempt = snapshot.attempts.find((a) => a.id === attemptId);
  const language = attempt?.challenge.language ?? "typescript";
  const runtimeState = useRuntimeState(language);

  const [source, setSource] = useState<string | undefined>(attempt?.solution);
  const [activity, setActivity] = useState<Activity>("idle");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [execution, setExecution] = useState<ExecutionResult>();
  const [testRun, setTestRun] = useState<TestRunResult | undefined>(attempt?.lastTestRun);
  const [justPassed, setJustPassed] = useState(false);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  // Actions read the latest values without being recreated on every keystroke.
  const latest = useRef({ attempt, source });
  useLayoutEffect(() => {
    latest.current = { attempt, source };
  });

  // Initialise editor state when the attempt first becomes available or the route changes.
  const initializedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (attempt && initializedFor.current !== attempt.id) {
      initializedFor.current = attempt.id;
      setSource(attempt.solution);
      setTestRun(attempt.lastTestRun);
      setExecution(undefined);
      setJustPassed(false);
      setError(undefined);
    }
  }, [attempt]);

  // Warm up the runtime for this challenge's language in the background.
  const hasAttempt = attempt !== undefined;
  useEffect(() => {
    if (!hasAttempt) return;
    const handle = setTimeout(() => void executionService.prepare(language), 300);
    return () => clearTimeout(handle);
  }, [hasAttempt, language, executionService]);

  useEffect(() => () => abort.current?.abort(), []);

  const currentSource = source ?? attempt?.solution ?? "";
  const dirty = attempt !== undefined && source !== undefined && source !== attempt.solution;

  const persist = useCallback(
    async (next: Attempt) => {
      setSaving(true);
      try {
        await attempts.save(next);
        setLastSavedAt(next.updatedAt);
        setError(undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Saving failed.");
      } finally {
        setSaving(false);
      }
    },
    [attempts],
  );

  const save = useCallback(async () => {
    const { attempt: current, source: text } = latest.current;
    if (!current || text === undefined) return;
    await persist(updateSolution(current, text, new Date()));
  }, [persist]);

  // Autosave after a short idle period.
  useEffect(() => {
    if (!settings.autoSave || !dirty || activity !== "idle") return;
    const handle = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(handle);
  }, [settings.autoSave, dirty, activity, currentSource, save]);

  const run = useCallback(async () => {
    const current = latest.current.attempt;
    if (!current || activity !== "idle") return;
    const controller = new AbortController();
    abort.current = controller;
    setActivity("running");
    setError(undefined);
    try {
      const runtime = await executionService.prepare(current.challenge.language);
      const result = await runtime.execute({
        source: latest.current.source ?? current.solution,
        timeoutMs: settings.executionTimeoutMs,
        signal: controller.signal,
      });
      setExecution(result);
    } finally {
      setActivity("idle");
    }
  }, [activity, executionService, settings.executionTimeoutMs]);

  const test = useCallback(
    async (includeHidden: boolean) => {
      const current = latest.current.attempt;
      if (!current || activity !== "idle") return;
      const tested = latest.current.source ?? current.solution;
      const controller = new AbortController();
      abort.current = controller;
      setActivity(includeHidden ? "submitting" : "testing");
      setError(undefined);
      setJustPassed(false);
      try {
        const runtime = await executionService.prepare(current.challenge.language);
        const cases = current.challenge.tests.cases
          .filter((c) => includeHidden || !c.hidden)
          .map(({ id, code }) => ({ id, code }));
        const result = await runtime.runTests({
          source: tested,
          prelude: current.challenge.tests.prelude,
          cases,
          includedHidden: includeHidden,
          timeoutMs: settings.executionTimeoutMs,
          signal: controller.signal,
        });
        setTestRun(result);
        setExecution(result.execution);
        if (result.execution.status === "cancelled") return;
        const now = new Date();
        // Re-read the attempt: it may have been autosaved while tests ran.
        const base = latest.current.attempt ?? current;
        const next = recordTestRun(
          updateSolution(base, tested, now),
          compactTestRun(result),
          tested,
          now,
        );
        await persist(next);
        if (includeHidden && next.status === "passed" && next.passedSolution === tested)
          setJustPassed(true);
      } finally {
        setActivity("idle");
      }
    },
    [activity, executionService, persist, settings.executionTimeoutMs],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    const current = latest.current.attempt;
    if (current) setSource(current.challenge.starterCode);
  }, []);

  const reveal = useCallback(async () => {
    const current = latest.current.attempt;
    if (current) await persist(revealReference(current, new Date()));
  }, [persist]);

  const saveNotes = useCallback(
    async (approachNotes: string) => {
      const current = latest.current.attempt;
      if (current)
        await persist({ ...current, approachNotes, updatedAt: new Date().toISOString() });
    },
    [persist],
  );

  const state: WorkspaceState = {
    attempt,
    loading: snapshot.status === "loading",
    source: currentSource,
    dirty,
    activity,
    saving,
    lastSavedAt,
    execution,
    testRun,
    justPassed,
    error,
  };

  return {
    state,
    runtimeState,
    settings,
    actions: {
      setSource,
      save,
      run,
      test: () => test(false),
      submit: () => test(true),
      stop,
      reset,
      reveal,
      saveNotes,
    },
  };
}
