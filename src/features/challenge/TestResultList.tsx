import type { TestCase } from "@/domain/challenge";
import type { TestResult, TestStatus } from "@/domain/execution";
import { formatDuration } from "@/utils/format";
import styles from "./TestResultList.module.css";

const ICONS: Record<TestStatus | "pending", string> = {
  pass: "✓",
  fail: "✗",
  error: "!",
  timeout: "⏱",
  "not-run": "–",
  pending: "○",
};

const LABELS: Record<TestStatus | "pending", string> = {
  pass: "Passed",
  fail: "Failed",
  error: "Error",
  timeout: "Timed out",
  "not-run": "Not run",
  pending: "Not run yet",
};

export interface TestResultListProps {
  cases: readonly TestCase[];
  results?: readonly TestResult[];
  /** Whether hidden tests' names may be shown (never their code). */
  revealHiddenNames?: boolean;
  showCode?: boolean;
}

export function TestResultList({
  cases,
  results,
  revealHiddenNames = false,
  showCode = false,
}: TestResultListProps) {
  const byId = new Map(results?.map((r) => [r.id, r]));
  let hiddenIndex = 0;
  return (
    <ul className={styles.list} aria-label="Test results">
      {cases.map((testCase) => {
        const result = byId.get(testCase.id);
        const status = result?.status ?? "pending";
        const name =
          testCase.hidden && !revealHiddenNames ? `Hidden test ${++hiddenIndex}` : testCase.name;
        return (
          <li
            key={testCase.id}
            className={`${styles.item} ${styles[status.replace("-", "")] ?? ""}`}
          >
            <div className={styles.row}>
              <span className={styles.icon} aria-hidden="true">
                {ICONS[status]}
              </span>
              <span className={styles.name}>
                {name}
                {testCase.hidden && <span className={styles.tag}>hidden</span>}
              </span>
              <span className="visually-hidden">{LABELS[status]}</span>
              {result?.durationMs !== undefined && (
                <span className={styles.duration}>{formatDuration(result.durationMs)}</span>
              )}
            </div>
            {result?.message && status !== "pass" && (
              <pre className={styles.message}>{result.message}</pre>
            )}
            {showCode && !testCase.hidden && (
              <details className={styles.code}>
                <summary>Test code</summary>
                <pre>{testCase.code}</pre>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
