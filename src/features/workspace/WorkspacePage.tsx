import { useEffect, useState } from "react";
import { Link, useBlocker, useParams } from "react-router";
import { useUnsavedChanges } from "@/app/unsaved-changes";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import { LANGUAGES } from "@/domain/languages";
import { CodeEditor } from "@/editor/CodeEditor";
import { ChallengeMeta, StatusBadge } from "@/features/challenge/ChallengeMeta";
import type { RuntimeState } from "@/services/execution/execution-service";
import { ChallengePanel } from "./ChallengePanel";
import { OutputPanel, type OutputTab } from "./OutputPanel";
import { useWorkspace } from "./useWorkspace";
import styles from "./WorkspacePage.module.css";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

export function WorkspacePage() {
  const { id = "" } = useParams();
  const { state, runtimeState, settings, actions } = useWorkspace(id);
  const unsaved = useUnsavedChanges();
  const [outputTab, setOutputTab] = useState<OutputTab>("tests");
  const [confirmReset, setConfirmReset] = useState(false);
  const { attempt, activity } = state;

  useEffect(() => {
    unsaved.setDirty(state.dirty);
    return () => unsaved.setDirty(false);
  }, [state.dirty, unsaved]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsaved.isDirty() && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved.isDirty()) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  if (state.loading) {
    return (
      <div className={styles.centered}>
        <Spinner label="Loading challenge" />
      </div>
    );
  }
  if (!attempt) {
    return (
      <div className={styles.centered}>
        <Notice tone="warning" title="Challenge not found">
          This challenge isn&apos;t stored in this browser.{" "}
          <Link to="/challenges">Browse your challenges</Link> or generate a new one.
        </Notice>
      </div>
    );
  }

  const busy = activity !== "idle";
  const runtimeBlocked = runtimeState.phase === "unsupported";
  const hasPreview = LANGUAGES[attempt.challenge.language].capabilities.preview;
  const run = () => {
    setOutputTab(hasPreview ? "preview" : "console");
    void actions.run();
  };
  const test = () => {
    setOutputTab("tests");
    void actions.test();
  };
  const submit = () => {
    setOutputTab("tests");
    void actions.submit();
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{attempt.challenge.title}</h1>
          <ChallengeMeta
            challenge={attempt.challenge}
            extra={<StatusBadge status={attempt.status} />}
          />
        </div>
        <div className={styles.controls}>
          <RuntimeIndicator
            label={LANGUAGES[attempt.challenge.language].label}
            state={runtimeState}
          />
          <span className={styles.saveState} aria-live="polite">
            {state.saving
              ? "Saving…"
              : state.dirty
                ? "Unsaved changes"
                : state.lastSavedAt
                  ? "Saved"
                  : ""}
          </span>
          <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
            Reset
          </Button>
          <Button
            onClick={() => void actions.save()}
            disabled={!state.dirty || busy}
            busy={state.saving}
            shortcut={`${MOD}S`}
          >
            Save
          </Button>
          {busy ? (
            <Button variant="danger" onClick={actions.stop}>
              Stop
            </Button>
          ) : (
            <Button onClick={run} disabled={runtimeBlocked} shortcut={`${MOD}↵`}>
              Run
            </Button>
          )}
          <Button
            onClick={test}
            busy={activity === "testing"}
            disabled={busy || runtimeBlocked}
            shortcut={`${MOD}⇧↵`}
          >
            {activity === "testing" ? "Testing…" : "Test"}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            busy={activity === "submitting"}
            disabled={busy || runtimeBlocked}
          >
            {activity === "submitting" ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>

      {(state.error || runtimeState.phase === "error" || runtimeState.phase === "unsupported") && (
        <div className={styles.alerts}>
          {state.error && (
            <Notice tone="danger" title="Something went wrong">
              {state.error}
            </Notice>
          )}
          {runtimeState.phase === "error" && (
            <Notice
              tone="danger"
              title="The language runtime failed to load"
              details={runtimeState.message}
            >
              Check your connection and try running again.
            </Notice>
          )}
          {runtimeState.phase === "unsupported" && (
            <Notice tone="warning" title="This language can't run here">
              {runtimeState.reason}
            </Notice>
          )}
        </div>
      )}

      <div className={styles.panes}>
        <section className={styles.challengePane} aria-label="Challenge">
          <ChallengePanel
            attempt={attempt}
            source={state.source}
            fontSize={settings.editorFontSize}
            onReveal={() => void actions.reveal()}
          />
        </section>
        <section className={styles.editorPane} aria-label="Code editor">
          <div className={styles.editorHeader}>
            <span className={styles.fileName}>
              {LANGUAGES[attempt.challenge.language].solutionFile}
            </span>
          </div>
          <div className={styles.editor}>
            <CodeEditor
              value={state.source}
              language={attempt.challenge.language}
              onChange={actions.setSource}
              label={`${LANGUAGES[attempt.challenge.language].label} solution editor`}
              tabSize={settings.tabSize}
              fontSize={settings.editorFontSize}
              diagnostics={state.execution?.diagnostics}
              onRun={run}
              onTest={test}
              onSave={() => void actions.save()}
            />
          </div>
        </section>
        <section className={styles.outputPane} aria-label="Output and tests">
          <OutputPanel
            attempt={attempt}
            tab={outputTab}
            onTabChange={setOutputTab}
            execution={state.execution}
            testRun={state.testRun}
            justPassed={state.justPassed}
            showDiagnostics={settings.showDiagnostics}
          />
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to starter code?"
        confirmLabel="Reset"
        tone="danger"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          actions.reset();
          setConfirmReset(false);
        }}
      >
        Your current solution will be replaced by the starter code. You can undo in the editor until
        you save.
      </ConfirmDialog>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="You have unsaved changes"
        confirmLabel="Leave without saving"
        tone="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        Your latest edits haven&apos;t been saved. Leave this challenge anyway?
      </ConfirmDialog>
    </div>
  );
}

function RuntimeIndicator({ label, state }: { label: string; state: RuntimeState }) {
  const text =
    state.phase === "ready"
      ? `${label} ready`
      : state.phase === "loading"
        ? `Loading ${label}${state.progress?.stage === "downloading" ? " (downloading)" : ""}…`
        : state.phase === "error"
          ? `${label} failed to load`
          : state.phase === "unsupported"
            ? `${label} unavailable`
            : `${label} idle`;
  return (
    <span className={`${styles.runtime} ${styles[state.phase]}`} role="status">
      {state.phase === "loading" ? (
        <Spinner size={10} />
      ) : (
        <span className={styles.runtimeDot} aria-hidden="true" />
      )}
      {text}
    </span>
  );
}
