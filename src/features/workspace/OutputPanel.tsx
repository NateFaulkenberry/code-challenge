import { Link } from "react-router";
import { Tabs } from "@/components/Tabs";
import { Notice } from "@/components/Notice";
import type { Attempt } from "@/domain/attempt";
import { LANGUAGES } from "@/domain/languages";
import {
  summarizeTestRun,
  type ExecutionResult,
  type ExecutionStatus,
  type TestRunResult,
} from "@/domain/execution";
import { TestResultList } from "@/features/challenge/TestResultList";
import { formatDuration } from "@/utils/format";
import styles from "./OutputPanel.module.css";
import { PreviewPane } from "./PreviewPane";

export type OutputTab = "tests" | "console" | "preview";

const STATUS_TEXT: Record<ExecutionStatus, string> = {
  success: "Finished",
  "runtime-error": "Runtime error",
  "compile-error": "Compilation failed",
  timeout: "Timed out",
  cancelled: "Stopped",
  "internal-error": "Runtime problem",
};

export function OutputPanel({
  attempt,
  tab,
  onTabChange,
  execution,
  testRun,
  justPassed,
  showDiagnostics,
}: {
  attempt: Attempt;
  tab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  execution: ExecutionResult | undefined;
  testRun: TestRunResult | undefined;
  justPassed: boolean;
  showDiagnostics: boolean;
}) {
  const summary = testRun ? summarizeTestRun(testRun) : undefined;
  const cases = attempt.challenge.tests.cases.filter((c) => !c.hidden || testRun?.includedHidden);
  const hasPreview = LANGUAGES[attempt.challenge.language].capabilities.preview;

  return (
    <Tabs
      label="Output"
      active={tab}
      onChange={onTabChange}
      tabs={[
        {
          id: "tests",
          label: "Tests",
          badge: summary && (
            <span className={summary.allPassed ? styles.countPass : styles.countFail}>
              {summary.passed}/{summary.total}
            </span>
          ),
        },
        {
          id: "console",
          label: "Console",
          badge: execution && execution.status !== "success" && (
            <span className={styles.countFail}>!</span>
          ),
        },
        ...(hasPreview ? [{ id: "preview" as const, label: "Preview" }] : []),
      ]}
    >
      <div className={styles.body} aria-live={tab === "preview" ? undefined : "polite"}>
        {hasPreview && (
          <PreviewPane language={attempt.challenge.language} hidden={tab !== "preview"} />
        )}
        {tab === "preview" ? null : tab === "tests" ? (
          <>
            {justPassed && (
              <Notice
                tone="success"
                title="All tests passed — challenge complete"
                action={
                  <Link to={`/challenges/${encodeURIComponent(attempt.id)}`}>
                    View in portfolio →
                  </Link>
                }
              >
                Your passing solution has been saved. Add approach notes from the portfolio view to
                explain your thinking.
              </Notice>
            )}
            {testRun && testRun.execution.status !== "success" && (
              <ExecutionNotice execution={testRun.execution} />
            )}
            {!testRun ? (
              <p className={styles.hint}>
                Run the visible tests with <kbd>Test</kbd>, then <kbd>Submit</kbd> to run the hidden
                tests too. Only a submission that passes every test completes the challenge.
              </p>
            ) : (
              <p className={styles.runSummary}>
                {testRun.includedHidden ? "Submission" : "Visible tests"} · {summary?.passed}/
                {summary?.total} passed · {formatDuration(testRun.execution.durationMs)}
              </p>
            )}
            <TestResultList
              cases={cases}
              {...(testRun ? { results: testRun.results } : {})}
              showCode
            />
          </>
        ) : execution ? (
          <div className={styles.console}>
            <p className={styles.statusLine}>
              <span className={execution.status === "success" ? styles.ok : styles.bad}>
                {STATUS_TEXT[execution.status]}
              </span>
              {execution.exitCode !== null && <span>exit code {execution.exitCode}</span>}
              <span>{formatDuration(execution.durationMs)}</span>
              {execution.truncated && <span className={styles.warn}>output truncated</span>}
            </p>
            {execution.status !== "success" && <ExecutionNotice execution={execution} />}
            {execution.stdout && (
              <pre className={styles.stdout} aria-label="Standard output">
                {execution.stdout}
              </pre>
            )}
            {execution.stderr && (
              <pre className={styles.stderr} aria-label="Standard error">
                {execution.stderr}
              </pre>
            )}
            {!execution.stdout && !execution.stderr && (
              <p className={styles.hint}>The program produced no output.</p>
            )}
            {showDiagnostics && (
              <details className={styles.diagnostics}>
                <summary>Runtime diagnostics</summary>
                <pre>
                  {JSON.stringify(
                    {
                      ...execution,
                      stdout: `${execution.stdout.length} chars`,
                      stderr: `${execution.stderr.length} chars`,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <p className={styles.hint}>
            <kbd>Run</kbd> executes your solution file and shows its console output here. Use it
            with <code>console.log</code> / <code>print</code> while you work.
          </p>
        )}
      </div>
    </Tabs>
  );
}

function ExecutionNotice({ execution }: { execution: ExecutionResult }) {
  const tone =
    execution.status === "cancelled"
      ? "info"
      : execution.status === "timeout"
        ? "warning"
        : "danger";
  const title =
    execution.status === "compile-error"
      ? "Your code didn't compile"
      : execution.status === "timeout"
        ? "Execution timed out"
        : execution.status === "cancelled"
          ? "Execution stopped"
          : execution.status === "internal-error"
            ? "The runtime ran into a problem"
            : "Your code threw an error";
  const firstDiagnostic = execution.diagnostics[0];
  return (
    <Notice tone={tone} title={title} {...(execution.stderr ? { details: execution.stderr } : {})}>
      {execution.message}
      {firstDiagnostic?.line !== undefined && ` (line ${firstDiagnostic.line})`}
      {execution.status === "timeout" &&
        " Check for infinite loops or promises that never resolve."}
    </Notice>
  );
}
